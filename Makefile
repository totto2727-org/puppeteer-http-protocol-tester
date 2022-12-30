LOG_DIR := $(shell cat ./setting.json | jq -r ".env.LOG_DIR")

client: dir test

dir:
	echo ${LOG_DIR}

test:
	cd protocol-test && npm start && echo finish

preprocessing:
	find ${LOG_DIR}/h2-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-har.json
	find ${LOG_DIR}/h2-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-performances.json
	find ${LOG_DIR}/h3-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-har.json
	find ${LOG_DIR}/h3-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-performances.json
	cat ~/log/chrome.pidstat | sed -e '/Linux/d' -e '/#/d' -e '/^$$/d' | sed -e 's/ \+/,/g' > ${LOG_DIR}/chrome.csv
	deno run --allow-read --allow-write process/preprocess.ts

stat-chrome:
	mkdir -p ~/log
	pidstat -h -H -C chrome 1 | tee ~/log/chrome.pidstat
	#pidstat -h -H -C chrome 1 | sed -e '/Linux/d' -e '/#/d' -e '/^$$/d' | sed -e 's/ \+/,/g' > ${LOG_DIR}/chrome.log

