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

# Upload updated requirements.txt
print('\n===== SFTP upload requirements.txt =====', flush=True)
sftp = client.open_sftp()
sftp.put(os.path.join(local_base, 'requirements.txt'), f'{remote_base}/requirements.txt')
print('  uploaded: requirements.txt', flush=True)
sftp.close()

# Install rank-bm25 (quick)
run_cmd('pip install rank-bm25', f'{venv_pip} install rank-bm25', 60)

# Run ingest (30 min timeout)
r = run_cmd('python ingest.py',
            f'cd {remote_base} && {venv_python} ingest.py',
            1800)

if r == 0:
    run_cmd('pm2 restart nurzeka-rag', 'pm2 restart nurzeka-rag', 30)
    run_cmd('pm2 status', 'pm2 status', 15)
else:
    print(f'[ERROR] ingest.py failed with exit code {r} — skipping pm2 restart', flush=True)

client.close()
print('\n===== ALL DONE =====', flush=True)
