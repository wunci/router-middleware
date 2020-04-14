const url = require("url");
class MiddleWare {
  constructor() {
    this.aloneMiddleWare = {};
    this.commonMiddleWare = [];
  }
  use(middleWare) {
    if (typeof middleWare === "string") {
      this.aloneMiddleWare[middleWare] = arguments[1];
    } else {
      this.commonMiddleWare.push(middleWare);
    }
  }
  handle(req, res, stacks) {
    const pathname = url.parse(req.url).pathname;
    const middleWareList = [
      ...this.commonMiddleWare,
      ...(this.aloneMiddleWare[pathname] ? this.aloneMiddleWare[pathname] : []),
      ...stacks
    ];
    const next = function() {
      const middleWare = middleWareList.shift();
      if (middleWare) {
        middleWare(req, res, next);
      }
    };
    next();
  }
}

module.exports = new MiddleWare();
