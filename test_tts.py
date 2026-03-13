#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_tts.py — Edge TTS ile Birinci Söz sesli okuma testi
Kullanım: python test_tts.py
Çıktı:    birinci_soz.mp3
"""

import re
import asyncio
import pathlib

try:
    import edge_tts
except ImportError:
    print("❌ edge-tts kurulu değil. Şunu çalıştır:")
    print("   pip install edge-tts")
    raise SystemExit(1)

SCRIPT_DIR = pathlib.Path(__file__).parent
MD_FILE    = SCRIPT_DIR / 'knowledge-base' / 'kulliyat' / 'sozler' / '001-birinci-soz.md'
OUTPUT_MP3 = SCRIPT_DIR / 'birinci_soz.mp3'

# En doğal Türkçe ses
VOICE = 'tr-TR-EmelNeural'   # Kadın sesi — doğal ve akıcı
# VOICE = 'tr-TR-AhmetNeural'  # Erkek sesi — daha resmi

def clean_text(raw: str) -> str:
    """Markdown ve Arapça metni temizle, TTS için hazırla."""
    # YAML frontmatter kaldır
    text = re.sub(r'^---[\s\S]*?---\s*', '', raw, count=1)

    # Arapça karakterleri kaldır (TTS karışır)
    text = re.sub(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', '', text)

    # Markdown başlık işaretlerini kaldır (**bold**, # başlık vb.)
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)

    # Parantez içi notları kaldır
    text = re.sub(r'\([^)]{0,40}\)', '', text)

    # Çoklu boşluk ve satırları temizle
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)

    # *** ayraçları kaldır
    text = re.sub(r'\*{3,}', '', text)

    return text.strip()


async def generate_speech(text: str, output: pathlib.Path, voice: str) -> None:
    """Edge TTS ile ses dosyası üret."""
    print(f"🎙️  Ses üretiliyor... ({len(text):,} karakter)")
    print(f"   Ses: {voice}")
    print(f"   Çıktı: {output.name}")
    print()

    communicate = edge_tts.Communicate(text, voice, rate="-5%", pitch="-2Hz")
    await communicate.save(str(output))

    size_kb = output.stat().st_size / 1024
    print(f"✅ Tamamlandı! {output.name} — {size_kb:.0f} KB")
    print()
    print(f"Oynatmak için:")
    print(f"  Dosyayı aç: {output.absolute()}")


def main():
    print("=" * 55)
    print("  Edge TTS — Birinci Söz Sesli Okuma Testi")
    print("=" * 55)

    if not MD_FILE.exists():
        print(f"❌ Dosya bulunamadı: {MD_FILE}")
        raise SystemExit(1)

    raw  = MD_FILE.read_text(encoding='utf-8', errors='ignore')
    text = clean_text(raw)

    # İlk 200 karakteri önizle
    print(f"📄 Metin önizleme (ilk 200 karakter):")
    print(f"   {text[:200]!r}")
    print()

    # Sadece ilk paragrafı test et (hız için)
    # Tamamı için: test_text = text
    paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 30]
    test_text  = '\n\n'.join(paragraphs[:6])   # İlk 6 paragraf
    print(f"🎯 Test için ilk 6 paragraf kullanılıyor ({len(test_text):,} karakter)")
    print()

    asyncio.run(generate_speech(test_text, OUTPUT_MP3, VOICE))


if __name__ == '__main__':
    main()
