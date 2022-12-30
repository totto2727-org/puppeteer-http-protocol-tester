LOG_DIR := $(shell cat ./setting.json | jq -r ".env.LOG_DIR")

client: dir test

dir:
	echo ${LOG_DIR}

test:
	ssh -t bws03 bash -c "cd puppeteer-http-protocol-tester/protocol-test && npm start"

preprocessing:
	scp ubnt:~/log/ubnt.csv ~/log/
	find ${LOG_DIR}/h2-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-har.json
	find ${LOG_DIR}/h2-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-performances.json
	find ${LOG_DIR}/h3-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-har.json
	find ${LOG_DIR}/h3-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-performances.json
	cat ~/log/chrome.pidstat | sed -e '/Linux/d' -e '/#/d' -e '/^$$/d' | sed -e 's/ \+/,/g' > ${LOG_DIR}/chrome.csv
	cat ~/log/nginx-bws03.pidstat | sed -e '/Linux/d' -e '/#/d' -e '/^$$/d' | sed -e 's/ \+/,/g' > ${LOG_DIR}/nginx-bws03.csv
	deno run --allow-read --allow-write process/preprocess.ts

log:
	rm -r ~/log
	mkdir -p ~/log

stat-chrome:
	ssh bws03 pidstat -h -H -C chrome 1 | tee ~/log/chrome.pidstat

stat-nginx-bws03:
	# ssh minis pidof nginx | sed 's/ /,/g' | xargs -I{} ssh minis pidstat -h -H -p {} 1 | tee ~/log/nginx-bws03.pidstat
	ssh minis pidstat -h -H -C nginx 1 | tee ~/log/chrome.pidstat

scp-ubnt:
	scp stat/watch-stat.sh stat/stat-conntrack.sh ubnt:~/
stat-ubnt: scp-ubnt
	TERM=xterm-color ssh -t ubnt sh watch-stat.sh
