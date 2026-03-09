export class tjLogger {

    do_debug = false;
    prefix = "";

    constructor(prefix, do_debug) {
        this.do_debug = do_debug;
        this.prefix = "[ThunderJira Logger | " + prefix + "] ";
    }

    changeDebug(do_debug) {
        this.do_debug = do_debug;
    }

    log(msg, do_debug = -1) {
        if(do_debug !== -1) this.do_debug = do_debug;
        if(this.do_debug === true) console.log(this.prefix + msg);
    }

    error(msg) {
        console.error(this.prefix + msg);
    }

    warn(msg) {
        console.warn(this.prefix + msg);
    }
};