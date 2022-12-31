#!/bin/bash
sudo apt install mercurial ninja-build \
	autoconf automake autotools-dev libtool pkg-config \
	libpcre3 libpcre3-dev zlib1g-dev

mkdir -p ~/quic
cd ~/quic || exit

# Build custom OpenSSL
git clone --depth 1 -b OpenSSL_1_1_1q+quic https://github.com/quictls/openssl
cd openssl || exit
./config --prefix="$PWD"/build --openssldir=/etc/ssl
make -j"$(nproc)"
make install_sw
cd ../

# Build Nginx-Quic
hg clone -b quic https://hg.nginx.org/nginx-quic
cd nginx-quic || exit
./auto/configure \
	--prefix="$PWD/build" \
	--with-debug \
	--with-http_v2_module \
	--with-http_v3_module \
	--with-stream \
	--with-stream_quic_module \
	--with-http_ssl_module \
	--with-cc-opt="-I../openssl/build/include" \
	--with-ld-opt="-L../openssl/build/lib"
make -j"$(nproc)"
make install

ln -s -f ~/dotfiles/static/quic/qnginx.conf ~/quic/nginx-quic/build/conf/nginx.conf
rm -r ~/quic/nginx-quic/build/html
ln -s -f ~/dotfiles/static/quic/html ~/quic/nginx-quic/build/html
sudo ln -s -f ~/dotfiles/static/quic/qnginx.service /lib/systemd/system/qnginx.service
