cd ~/quic
git clone https://github.com/cloudflare/quiche.git
cd quiche

git submodule update --init
cargo build --examples
# cargo run --bin quiche-client -- https://cloudflare-quic.com/
