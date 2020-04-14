const http = require("http");
const url = require("url");
const Router = require("./router");
const render = require("./render");
const app = require("./middleware");
const route = new Router();

// cookie中间件
const cookie = function(req, res, next) {
  var cookie = req.headers.cookie;
  var cookies = {};
  if (cookie) {
    var list = cookie.split(";");
    for (var i = 0; i < list.length; i++) {
      var pair = list[i].split("=");
      cookies[pair[0].trim()] = pair[1];
    }
  }
  req.cookies = cookies;
  next();
};
app.use(cookie);
app.use(function(req, res, next) {
  req.query = url.parse(req.url, true).query;
  next();
});
app.use(function(req, res, next) {
  res.render = function(file, data) {
    let template = render(file, data);
    res.writeHead(200, { "Content-Type": "text/html;charset=utf8" });
    res.end(template);
  };
  next();
});

// 路由
// /user/123
route.get("/user/:id", function(req, res) {
  console.log(req.params, req.cookies);
  const data = {
    items: [{ name: "wclimb" }, { name: "other" }],
    user: { name: "123" }
  };
  res.render("template", data);
});
// /test?a=1&b=2
route.get("/test", function(req, res) {
  const query = req.query;
  res.end(JSON.stringify(query));
});

http
  .createServer(function(req, res) {
    route.install(req, res, app);
  })
  .listen(3000);
