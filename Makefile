.ONESHELL:

LOG_DIR := $(shell cat ./setting.json | jq -r ".env.LOG_DIR")

test:
	-ssh bws03 -t "rm -r log"
	ssh bws03 -t "cd puppeteer-http-protocol-tester/protocol-test && bash -i -c 'npm start'"

preprocessing:
	scp ubnt:~/log/ubnt.csv ${LOG_DIR}
	scp -r bws03:puppeteer-http-protocol-tester/$$(basename ${LOG_DIR}) ${LOG_DIR}

	find ${LOG_DIR}/h2-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-har.json
	find ${LOG_DIR}/h2-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-performances.json
	find ${LOG_DIR}/h3-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-har.json
	find ${LOG_DIR}/h3-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-performances.json

	cat ${LOG_DIR}/chrome.pidstat | sed -e '/Linux/d' -e '/#/d' -e '/^$$/d' | sed -e 's/ \+/,/g' > ${LOG_DIR}/chrome.csv
	cat ${LOG_DIR}/nginx-bws03.pidstat | sed -e '/Linux/d' -e '/#/d' -e '/^$$/d' | sed -e 's/ \+/,/g' > ${LOG_DIR}/nginx-bws03.csv
	deno run --allow-read --allow-write process/preprocess.ts

mkdir-log:
	-rm -r ${LOG_DIR}
	mkdir -p ${LOG_DIR}

stat-chrome:
	ssh bws03 pidstat -h -H -C chrome 1 | tee ${LOG_DIR}/chrome.pidstat

stat-nginx-bws03:
	# ssh minis pidof nginx | sed 's/ /,/g' | xargs -I{} ssh minis pidstat -h -H -p {} 1 | tee ~/log/nginx-bws03.pidstat
	ssh minis pidstat -h -H -C nginx 1 | tee ${LOG_DIR}/chrome.pidstat

scp-ubnt:
	scp stat/watch-stat.sh stat/stat-conntrack.sh ubnt:~/
stat-ubnt: scp-ubnt
	TERM=xterm-color ssh -t ubnt sh watch-stat.sh
