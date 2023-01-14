.ONESHELL:

LOG_DIR := $(shell cat ./setting.json | jq -r ".env.LOG_DIR")
SSH_BASE_DIR := puppeteer-http-protocol-tester

test:
	-ssh bws03 -t "rm -r log"
	ssh bws03 -t "cd ${SSH_BASE_DIR}/protocol-test && bash -i -c 'npm start'"

preprocessing: mkdir-log
	#rsync -av -z -P –-exclude '*netlog.json' bws03:${SSH_BASE_DIR}/$$(basename ${LOG_DIR})/ ${LOG_DIR}
	rsync -av -z -P --exclude '*netlog.json' bws03:/home/totto2727/puppeteer-http-protocol-tester/log/ log
	scp ubnt:~/log/ubnt.csv ${LOG_DIR}

	find ${LOG_DIR}/h2-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-har.json
	find ${LOG_DIR}/h3-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-har.json
	find ${LOG_DIR}/h2-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-performances.json
	find ${LOG_DIR}/h3-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-performances.json

	echo "Time,UID,PID,%usr,%system,%guest,%wait,%CPU,CPU,Command" > ${LOG_DIR}/chrome.csv
	echo "Time,UID,PID,%usr,%system,%guest,%wait,%CPU,CPU,Command" > ${LOG_DIR}/nginx-bws03.csv

	cat ${LOG_DIR}/chrome.pidstat | sd '^Linux.*$$' '' | sd '^#.*$$' '' | sd '^\n' '' | sd ' +' ',' >> ${LOG_DIR}/chrome.csv
	cat ${LOG_DIR}/nginx-bws03.pidstat | sd '^Linux.*$$' '' | sd '^#.*$$' '' | sd '^\n' '' | sd ' +' ',' >> ${LOG_DIR}/nginx-bws03.csv

	deno run --allow-read --allow-write process/preprocess.ts

mkdir-log:
	mkdir -p ${LOG_DIR}

stat-chrome: mkdir-log
	ssh bws03 pidstat -h -H -C chrome 1 | tee ${LOG_DIR}/chrome.pidstat

stat-nginx-bws03: mkdir-log
	ssh minis pidstat -h -H -C nginx 1 | tee ${LOG_DIR}/nginx-bws03.pidstat

scp-ubnt:
	scp stat/watch-stat.sh stat/stat-conntrack.sh ubnt:~/
stat-ubnt: scp-ubnt
	TERM=xterm-color ssh -t ubnt sh watch-stat.sh
