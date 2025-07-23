# Install main dependencies
if command -v bun >/dev/null 2>&1; then
  bun install
elif command -v npm >/dev/null 2>&1; then
  npm install
else
  echo "Error: Neither bun nor npm is installed." >&2
  exit 1
fi

# Install submodule dependencies
cd chat-stream
if command -v bun >/dev/null 2>&1; then
  bun install
elif command -v npm >/dev/null 2>&1; then
  npm install
else
  echo "Error: Neither bun nor npm is installed." >&2
  exit 1
fi
cd ..

echo "Setup complete! Both repositories have their dependencies installed."