LOG_DIR := $(shell cat ./setting.json | jq ".env.LOG_DIR")

research: test preprocessing

test:
	cd protocol-test && npm start

preprocessing:
	cd process && find ${LOG_DIR}/h2-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-har.json
	cd process && find ${LOG_DIR}/h2-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h2-performances.json
	cd process && find ${LOG_DIR}/h3-har -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-har.json
	cd process && find ${LOG_DIR}/h3-performances -type f | xargs cat | jq -s '. | sort_by(.number)' > ${LOG_DIR}/h3-performances.json
	cd process && deno run --allow-read --allow-write preprocess.ts
