export type WaitGroupConstructorParameter = { waitIntervalMilli?: number };

export class WaitGroup {
    waitNumber = 0;
    waitIntervalMilli = 10;

    constructor(parameter?: WaitGroupConstructorParameter) {
        if (parameter?.waitIntervalMilli) {
            this.setWaitInterval(parameter.waitIntervalMilli);
        }
    }

    add() {
        this.setWaitNumber(this.waitNumber + 1);
    }

    done() {
        this.setWaitNumber(this.waitNumber - 1);
    }

    async wait(max = 1) {
        if (max < 1) {
            Error("1以上の値を設定してください");
        }
        while (this.waitNumber > max - 1) {
            await this.sleep(this.waitIntervalMilli);
        }
    }

    getWaitNumber() {
        return this.waitNumber;
    }
    setWaitNumber(value: number) {
        if (value < 0) {
            throw Error("すでに全ての処理が終了しています");
        }
        this.waitNumber = value;
    }

    setWaitInterval(value: number) {
        if (value < 1) {
            throw Error("1以上の値を設定してください(単位ms)");
        }
        this.waitIntervalMilli = value;
    }

    sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

