import paramiko, sys, time, os

host = '192.168.0.11'
user = 'akin'
pwd  = 'akin2019'

local_base  = r'C:\Users\aysan\Desktop\risale-nur-ai\rag_service'
remote_base = '/www/wwwroot/nurzek/rag_service'
venv_python = '/www/wwwroot/nurzek/venv/bin/python'
venv_pip    = '/www/wwwroot/nurzek/venv/bin/pip'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=pwd,
               look_for_keys=False, allow_agent=False, timeout=20)

def run_cmd(label, cmd, timeout_sec=60):
    print(f'\n===== {label} =====', flush=True)
    chan = client.get_transport().open_session()
    chan.get_pty()
    chan.exec_command(cmd)
    deadline = time.time() + timeout_sec
    while True:
        if chan.recv_ready():
            chunk = chan.recv(4096).decode('utf-8', 'replace')
            sys.stdout.write(chunk); sys.stdout.flush()
        if chan.recv_stderr_ready():
            chunk = chan.recv_stderr(4096).decode('utf-8', 'replace')
            sys.stderr.write(chunk); sys.stderr.flush()
        if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
            break
        if time.time() > deadline:
            print(f'[TIMEOUT after {timeout_sec}s]', flush=True)
            break
        time.sleep(0.2)
    code = chan.recv_exit_status()
    print(f'--- exit {code}: {label} ---', flush=True)
    return code

# ── Step 1: Fix permissions ──────────────────────────────────────────────
sudo_chown = f"echo '{pwd}' | sudo -S chown -R akin:akin {remote_base}"
r = run_cmd('sudo chown rag_service', sudo_chown, 20)
if r != 0:
    # Try without sudo – maybe running as www already has a password sudoers entry
    print('[WARN] sudo chown failed, trying chmod +w as current user', flush=True)
run_cmd('chmod u+rw rag_service', f'chmod -R u+rw {remote_base}', 10)

# ── Step 2: Upload updated files via SFTP ───────────────────────────────
print('\n===== SFTP UPLOAD =====', flush=True)
sftp = client.open_sftp()
for fname in ['app.py', 'ingest.py', 'requirements.txt']:
    lpath = os.path.join(local_base, fname)
    rpath = f'{remote_base}/{fname}'
    sftp.put(lpath, rpath)
    print(f'  uploaded: {fname}', flush=True)
sftp.close()
print('--- SFTP done ---', flush=True)

# ── Step 3: pip install ──────────────────────────────────────────────────
req_path = f'{remote_base}/requirements.txt'
run_cmd('pip install', f'cd {remote_base} && {venv_pip} install -r requirements.txt', 300)

client.close()
print('\n===== UPLOAD + INSTALL DONE =====', flush=True)
