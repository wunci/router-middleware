const url = require("url");
class Router {
  constructor() {
    this.route = {};
    ["HEAD", "OPTIONS", "GET", "PUT", "PATCH", "POST", "DELETE"].forEach(
      method => {
        method = method.toLowerCase();
        this.route[method] = [];
        this[method] = function(path, ...stacks) {
          this.route[method].push([path, [...stacks]]);
        };
      }
    );
  }
  install(req, res, app) {
    const pathname = url.parse(req.url).pathname;
    const method = req.method.toLowerCase();
    if (this.route[method]) {
      for (let i = 0; i < this.route[method].length; i++) {
        const [path, stacks] = this.route[method][i];
        const { keys, regExp } = this.pathRegexp(path);
        const mathed = regExp.exec(pathname);
        if (mathed) {
          req.params = {};
          for (let j = 0; j < keys.length; j++) {
            const key = keys[j];
            req.params[key] = mathed[j + 1];
          }
          return app.handle(req, res, stacks);
        }
      }
      res.writeHead(404);
      res.end("404");
    } else {
      res.writeHead(404);
      res.end("404");
    }
  }
  pathRegexp(path) {
    const keys = [];
    path = path.replace(/\/:(\w+)?(?:\/)?/g, function(match, key) {
      keys.push(key);
      return `\\/([^\\/]+)(?:\\/)?`;
    });
    return {
      keys,
      regExp: new RegExp(`^${path}$`)
    };
  }
}

module.exports = Router;
