## 前言

今天来实现一个 `node` 的路由和中间件

## 铺垫

我们首先起一个服务

```js
const http = require("http");
const url = require("url");
http
  .createServer(function(req, res) {
    const pathname = url.parse(req.url).pathname;
    res.end(req.method.toLowerCase() + ": " + pathname);
  })
  .listen(3000);
```
访问 `http://localhost:3000/` 显示 `get: /`
访问 `http://localhost:3000/test` 显示 `get: /test`

最简单的方法就是下面代码判断逻辑，这样做的话太麻烦了，杂糅在一起了，还得进一步判断不同的请求方法，到底是 `get` 还是 `post` 还是其他的，重复代码也会增加
```js
switch (pathname) {
  case "/":
    res.end("root");
    break;
  case "/test":
    res.end("test");
    break;
  default:
    res.writeHead(404);
    res.end("404");
    break;
}
```
## 实现路由

我们按照 `RESTful` 风格来实现我们的路由，他们应该是这样的
```js
route.get("/user", function(req, res) {});
route.post("/user", function(req, res) {});
route.delete("/user", function(req, res) {});

// 还可以是

route.get("/:id", function(req, res) {});
route.get("/user/:pid/account", function(req, res) {});
```
上面我们已经启动服务了，现在我们新建应该路由文件，就叫 `router.js` 吧，然后在上面👆的服务引入 `const Router = require('./router');`

router.js
```js
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
}
module.exports = Router;
```
他们的构造函数和大致的结构应该是这样的，当我们 `new Router();` 初始化支持的路由方法，你会发现每当我们 `route.get()` 或者 `route.post()` 都会把他们存到对应的 `route` 对象数组内部，以便后续使用，这叫路由收集。
那么问题来了，我都收集了，需要调用
```diff
const http = require("http");
const url = require("url");
+ const Router = require("./router");

// 路由
+ route.get("/user/:id", function(req, res) {
+   res.end("id");
+ });

http
  .createServer(function(req, res) {
+    route.install(req, res);
  })
  .listen(3000);
```

回到router.js
```diff
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
+  install(req, res, app) {
+    const pathname = url.parse(req.url).pathname;
+    const method = req.method.toLowerCase();
+    if (this.route[method]) {
+      for (let i = 0; i < this.route[method].length; i++) {
+        const [path, stacks] = this.route[method][i];
+        const { keys, regExp } = this.pathRegexp(path);
+        const mathed = regExp.exec(pathname);
+        if (mathed) {
+          req.params = {};
+          for (let j = 0; j < keys.length; j++) {
+            const key = keys[j];
+            req.params[key] = mathed[j + 1];
+          }
+          return app.handle(req, res, stacks);
+        }
+      }
+      res.writeHead(404);
+      res.end("404");
+    }else{
+      res.writeHead(404);
+      res.end("404");
+    }
+  }
+  pathRegexp(path) {
+    const keys = [];
+    path = path.replace(/\/:(\w+)?(?:\/)?/g, function(match, key) {
+      keys.push(key);
+      return `\\/([^\\/]+)(?:\\/)?`;
+    });
+    return {
+      keys,
+      regExp: new RegExp(`^${path}$`)
+    };
+  }
}
module.exports = Router;
```
你会发现多了两个方法`install`，`pathRegexp`。`install`是用来注册路由的，首先拿到请求方法和路径，然后去之前收集的路由查找是否存在这个路由，如果不存在直接返回404，如果存在会调用 `pathRegexp` 做路径匹配，因为可能会有 `/:id`、 `/user`，这种不同的路由，这里借鉴一下 `koa-router` 获取参数的方式，比如我们路由是 `/:id/test/:p`，当我们访问 `/123/test/456`的时候，我们可以拿到一个对象`params: {id:123,p:456}`。其实 `koa-router` 的路由匹配规则用的是 [path-to-regexp](https://github.com/pillarjs/path-to-regexp) 这个包，我们这里是自己做的匹配，可以思考一下上面 `pathRegexp` 方法的实现，正则好的同学应该看得很明白。如果发现匹配，我们会把 `params` 赋值到 `req` 对象上，然后调用执行中间件的操作，也就是 `app.handle(req, res, stacks);`，你会发现上面我们注册的时候压根就没有传递 `app`，因为这是后面需要讲的内容，实现中间件

顺便说一下，如果你想让上面的代码正常执行，把 `app.handle()` 这行代码去掉，然后 `res.end()` 就可以正常执行了

## 中间件

中间件其实就是洋葱模型了，先收集中间件的依赖，然后去递归一个个执行中间件，感兴趣可以去看看我直接写的[Koa源码系列之koa-compose](http://www.wclimb.site/2019/12/11/Koa%E6%BA%90%E7%A0%81%E7%B3%BB%E5%88%97%E4%B9%8Bkoa-compose/)

中间件我们希望他是这么注册收集的
```js
app.use(cookie);
app.use(function(req, res, next) {
  req.query = url.parse(req.url, true).query;
  next();
});
```

新建文件`middleware.js`，内容如下
```js
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
```
`aloneMiddleWare` 先不看，`use`方法是进行依赖收集的，`handle`方法是集中处理中间件的方法，递归调用，依次执行。关键代码
```js
const next = function() {
  const middleWare = middleWareList.shift();
  if (middleWare) {
    middleWare(req, res, next);
  }
};
next();
```
每次取出队列里的第一个，然后执行它，然后把 `next` 方法传递一下，所以我们必须在中间件内部调用 `next` 方法，不然流程会中断。

我们刚刚说的 `aloneMiddleWare` 有上面用的呢，其实是为了优化性能，因为有的中间件不是所有路由都使用到的，可能就一个路由用到了，那么如果我们把它注册在全局，那么所有的路由都会走一遍。所以这里做个优化，中间件支持如下注册方式，这样就只有 `/alone` 这个路由会走这个中间件，上面的存取使用 `this.aloneMiddleWare[middleWare];` 可能不严谨，最好做正则匹配，这里主要是提供思路
```js
app.use('/alone', middleware)
```

这样之前的 `router.js` 内的 `app.handle` 方法就可以执行了，然后依次执行中间件，最后才执行路由上面写得回调方法

另外还执行以下方法传递中间件
```js
route.get("/user/:id", middleware1, middleware2, function(req, res) {
  res.end("id");
});
```

嗯，现在大致完成了功能，但是呢，好像我们可以把上一篇写的模版引擎拿过来，借鉴一下 [koa-views](https://www.npmjs.com/package/koa-views) 方法，使用 `ctx.render(file,{})` 渲染模版

## 支持模版引擎

新建文件`render.js`
```js
const fs = require("fs");

const render = function(file, data) {
  let str = fs.readFileSync(`${file}.ejs`, "utf8");
  const escape = function(html) {
    return String(html)
      .replace(/&(?!\w+;)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;"); // IE下不支持&apos;(单引号)转义
  };
  str = str
    .replace(/\n/g, "")
    .replace(/\s{2,}/g, "")
    .replace(/<%-([\S\s]+?)%>/g, function(match, val) {
      return `'+ ${val} +'`;
    })
    .replace(/<%=([\S\s]+?)%>/g, function(match, val) {
      return `'+ escape(${val}) +'`;
    })
    .replace(/<%([\S\s]+?)%>/g, function(match, val) {
      return `';\n${val}\ntpl +='`;
    });

  str = `let tpl = '${str}';return tpl;`;
  str = `with(option){${str};return tpl;}`;
  const complied = new Function("option", str);
  let result;
  try {
    result = complied(data);
  } catch (error) {
    console.log(error);
  }
  return result;
};
module.exports = render;
```

### 写一个支持模版引擎的中间件

```js
app.use(function(req, res, next) {
  res.render = function(file, data) {
    let template = render(file, data);
    res.writeHead(200, { "Content-Type": "text/html;charset=utf8" });
    res.end(template);
  };
  next();
});
```

## 使用

```js
app.get("/user/:id", function(req, res) {
  const obj = {
    items: [{ name: "123" }, { name: "wclimb" }],
  };
  res.render("template", obj);
});
```
`template` 是 `template.ejs`文件，当然得有

`template.ejs`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <% for (var i = 0; i < items.length; i++) { %> <% var item = items[i];%>
    <p><%= (i+1) %>、<%-item.name%></p>
    <% } %>

    <div>测试一下</div>

    <% if (user) { %>
    <h2><%=user.name%></h2>
    <% } else { %>
    <h2>匿名用户</h2>
    <% } %>
  </body>
</html>
```

## 结尾

至此，我们实现了路由、中间件、模版引擎，完整流程串起来可以方便我们写一些 `demo` 了，额，但是别在生产环境使用，不保证代码的健壮。当然我也相信你绝对不会上生产，因为这就是个 `demo`，其实那么框架也是这么一步步搭建起来的，原理思想差不多

以上代码已经上传到Github：https://github.com/wclimb/router-middleware

## Reference

* [深入浅出nodejs](https://book.douban.com/subject/25768396/)

本文地址 [Nodejs之实现路由和中间件](http://www.wclimb.site/2020/04/14/node-route-middleware/)