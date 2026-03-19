import json
import os
import shutil
import asyncio
from collections import defaultdict
from datetime import datetime

import igraph as ig
import leidenalg
import networkx as nx
from dotenv import load_dotenv
from openai import OpenAI


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
CACHE_DIR = os.path.join(BASE_DIR, "nano_graphrag_cache")
GRAPH_PATH = os.path.join(CACHE_DIR, "graph_chunk_entity_relation.graphml")
COMMUNITY_REPORTS_PATH = os.path.join(CACHE_DIR, "kv_store_community_reports.json")

load_dotenv(os.path.join(ROOT_DIR, ".env"), override=True)


def _backup_file(path: str) -> None:
    if not os.path.exists(path):
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{path}.bak_{stamp}"
    shutil.copy2(path, backup)
    print(f"[backup] {backup}")


def _to_float(value, default: float = 1.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _compute_leiden_clusters(graph: nx.Graph, resolution: float = 0.9, seed: int = 42) -> dict[str, int]:
    node_ids = list(graph.nodes())
    node_to_idx = {node_id: idx for idx, node_id in enumerate(node_ids)}

    edges = []
    weights = []
    for src, dst, data in graph.edges(data=True):
        if src == dst:
            continue
        edges.append((node_to_idx[src], node_to_idx[dst]))
        weights.append(_to_float((data or {}).get("weight"), 1.0))

    if not node_ids:
        return {}

    if not edges:
        return {node_id: idx for idx, node_id in enumerate(node_ids)}

    ig_graph = ig.Graph(n=len(node_ids), edges=edges, directed=False)
    partition = leidenalg.find_partition(
        ig_graph,
        leidenalg.RBConfigurationVertexPartition,
        weights=weights,
        resolution_parameter=resolution,
        seed=seed,
    )

    memberships = partition.membership
    return {node_id: int(memberships[idx]) for idx, node_id in enumerate(node_ids)}


def _apply_clusters_to_graph(graph: nx.Graph, cluster_map: dict[str, int]) -> None:
    for node_id in graph.nodes():
        cluster_id = int(cluster_map.get(node_id, -1))
        graph.nodes[node_id]["clusters"] = json.dumps([
            {"level": 1, "cluster": cluster_id}
        ])


def _build_community_schema(graph: nx.Graph) -> dict[str, dict]:
    results = defaultdict(
        lambda: {
            "level": None,
            "title": None,
            "edges": set(),
            "nodes": set(),
            "chunk_ids": set(),
            "occurrence": 0.0,
            "sub_communities": [],
        }
    )
    max_num_ids = 0
    levels = defaultdict(set)

    for node_id, node_data in graph.nodes(data=True):
        clusters_raw = node_data.get("clusters")
        if not clusters_raw:
            continue

        try:
            clusters = json.loads(clusters_raw)
        except Exception:
            continue

        node_edges = graph.edges(node_id)
        source_id_raw = str(node_data.get("source_id") or "")
        chunk_ids = [part for part in source_id_raw.split("<SEP>") if part]

        for cluster in clusters:
            level = int(cluster.get("level", 1))
            cluster_key = str(cluster.get("cluster"))
            levels[level].add(cluster_key)
            results[cluster_key]["level"] = level
            results[cluster_key]["title"] = f"Cluster {cluster_key}"
            results[cluster_key]["nodes"].add(node_id)
            results[cluster_key]["edges"].update([tuple(sorted(e)) for e in node_edges])
            results[cluster_key]["chunk_ids"].update(chunk_ids)
            max_num_ids = max(max_num_ids, len(results[cluster_key]["chunk_ids"]))

    if max_num_ids <= 0:
        max_num_ids = 1

    ordered_levels = sorted(levels.keys())
    for i, curr_level in enumerate(ordered_levels[:-1]):
        next_level = ordered_levels[i + 1]
        this_level_comms = levels[curr_level]
        next_level_comms = levels[next_level]
        for comm in this_level_comms:
            results[comm]["sub_communities"] = [
                c for c in next_level_comms if results[c]["nodes"].issubset(results[comm]["nodes"])
            ]

    for key, value in results.items():
        value["edges"] = [list(e) for e in list(value["edges"])]
        value["nodes"] = list(value["nodes"])
        value["chunk_ids"] = list(value["chunk_ids"])
        value["occurrence"] = len(value["chunk_ids"]) / max_num_ids

    return dict(results)


def _build_report(schema_item: dict, graph: nx.Graph) -> dict:
    nodes = schema_item.get("nodes", [])
    edges = schema_item.get("edges", [])
    chunk_ids = schema_item.get("chunk_ids", [])
    cluster_title = schema_item.get("title", "Cluster")

    degree_pairs = []
    for node_id in nodes:
        degree_pairs.append((node_id, int(graph.degree(node_id))))
    degree_pairs.sort(key=lambda x: x[1], reverse=True)
    top_nodes = [n for n, _ in degree_pairs[:8]]

    findings = [
        {
            "summary": "Merkezi kavramlar",
            "explanation": "Bu community icinde en baglantili varliklar: " + ", ".join(top_nodes[:5]) if top_nodes else "Merkezi varlik tespit edilemedi.",
        },
        {
            "summary": "Iliski yogunlugu",
            "explanation": f"Toplam iliski sayisi: {len(edges)}. Toplam varlik sayisi: {len(nodes)}.",
        },
        {
            "summary": "Kaynak kapsami",
            "explanation": f"Toplam bagli chunk sayisi: {len(chunk_ids)}.",
        },
    ]

    summary = (
        f"{cluster_title} icinde {len(nodes)} varlik, {len(edges)} iliski ve "
        f"{len(chunk_ids)} chunk baglantisi bulunuyor."
    )
    rating = round(min(10.0, 4.0 + (len(nodes) / 200.0) + (len(edges) / 300.0)), 2)

    report_json = {
        "title": cluster_title,
        "summary": summary,
        "rating": rating,
        "rating_explanation": "Derecelendirme varlik/iliski yogunluguna gore otomatik hesaplandi.",
        "findings": findings,
    }

    report_string = "\n\n".join([
        f"# {report_json['title']}",
        report_json["summary"],
        "\n".join([f"## {f['summary']}\n\n{f['explanation']}" for f in findings]),
    ])

    return {
        "report_string": report_string,
        "report_json": report_json,
        **schema_item,
    }


def _make_report_llm():
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    deepseek_base = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

    if openrouter_key:
        client = OpenAI(api_key=openrouter_key, base_url="https://openrouter.ai/api/v1", timeout=90, max_retries=2)
        model = "openai/gpt-4o-mini"
    elif deepseek_key:
        client = OpenAI(api_key=deepseek_key, base_url=deepseek_base, timeout=90, max_retries=2)
        model = "deepseek-chat"
    else:
        return None

    async def _llm(prompt, system_prompt=None, **kwargs):
        full_prompt = str(system_prompt or "") + "\n\n" + str(prompt or "")
        response_format = kwargs.get("response_format") or {}

        def _call():
            return client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": full_prompt[:12000]}],
                temperature=0.1,
                stream=False,
                response_format=response_format if isinstance(response_format, dict) and response_format else None,
            )

        resp = await asyncio.to_thread(_call)
        return str(resp.choices[0].message.content or "")

    return _llm


async def _regenerate_reports_with_llm() -> int:
    from nano_graphrag._op import generate_community_report
    from nano_graphrag._storage import JsonKVStorage, NetworkXStorage
    from nano_graphrag._utils import convert_response_to_json

    llm_func = _make_report_llm()
    if llm_func is None:
        return 0

    global_config = {
        "working_dir": CACHE_DIR,
        "addon_params": {},
        "tiktoken_model_name": "gpt-4o",
        "best_model_max_token_size": 32768,
        "special_community_report_llm_kwargs": {"response_format": {"type": "json_object"}},
        "best_model_func": llm_func,
        "convert_response_to_json_func": convert_response_to_json,
    }

    graph_storage = NetworkXStorage(namespace="chunk_entity_relation", global_config=global_config)
    community_kv = JsonKVStorage(namespace="community_reports", global_config=global_config)

    await community_kv.drop()
    await generate_community_report(community_kv, graph_storage, global_config)
    await community_kv.index_done_callback()

    keys = await community_kv.all_keys()
    return len(keys)


def main() -> None:
    if not os.path.exists(GRAPH_PATH):
        raise FileNotFoundError(f"Graph file not found: {GRAPH_PATH}")

    print(f"[load] {GRAPH_PATH}")
    graph = nx.read_graphml(GRAPH_PATH)
    print(f"[graph] nodes={graph.number_of_nodes()} edges={graph.number_of_edges()}")

    _backup_file(GRAPH_PATH)
    _backup_file(COMMUNITY_REPORTS_PATH)

    cluster_map = _compute_leiden_clusters(graph)
    unique_clusters = sorted(set(cluster_map.values()))
    print(f"[cluster] communities={len(unique_clusters)}")

    _apply_clusters_to_graph(graph, cluster_map)
    nx.write_graphml(graph, GRAPH_PATH)
    print(f"[write] {GRAPH_PATH}")

    llm_report_count = asyncio.run(_regenerate_reports_with_llm())
    if llm_report_count > 0:
        print(f"[write] {COMMUNITY_REPORTS_PATH} (llm)")
        print(f"[done] report_count={llm_report_count}")
        return

    print("[warn] No API key found for LLM report generation; using deterministic fallback reports")
    schema = _build_community_schema(graph)
    reports = {}
    for cluster_key, schema_item in schema.items():
        reports[cluster_key] = _build_report(schema_item, graph)

    with open(COMMUNITY_REPORTS_PATH, "w", encoding="utf-8") as f:
        json.dump(reports, f, ensure_ascii=False, indent=2)
    print(f"[write] {COMMUNITY_REPORTS_PATH} (fallback)")
    print(f"[done] report_count={len(reports)}")


if __name__ == "__main__":
    main()