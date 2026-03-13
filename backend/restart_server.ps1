
$port = 3001
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($process) {
    echo "Found process on port $port. PID: $($process.OwningProcess)"
    Stop-Process -Id $process.OwningProcess -Force
    echo "Process killed."
} else {
    echo "No process found on port $port."
}

echo "Starting backend server..."
npm start
