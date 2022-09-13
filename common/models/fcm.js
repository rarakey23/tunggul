var admin = require("firebase-admin");
var path = require("path");
var loopback = require("loopback");
var async = require("async");

module.exports = function(FCM) {
  FCM.tofcm = function(obj) {
    var ret = {};
    Object.keys(obj).forEach(function(k) {
      var val = obj[k];
      switch (typeof val) {
        case "number":
          ret[k] = val.toString();
          break;
        case "boolean":
          ret[k] = val.toString();
          break;
        case "object":
          break;
        case "string":
          ret[k] = val;
      }
    });
    return ret;
  };

  FCM.prototype.process = function(options) {
    var AppUser = loopback.getModelByType("AppUser");
    if (FCM.status == "disable") {
      return;
    }
    var self = this;
    if (self.deviceToken) {
        var message = {
          token: self.deviceToken
        };
        if (self.highPriority) {
          message.android = {
            priority: "high"
          };
        }
        if (self.title && self.body) {
            message.notification = {
              title : self.title,
              body : self.body
            };
        }
        if (self.data) {
          message.data = FCM.tofcm(self.data);
        } else {
          message.data = {};
        }
        message.data.type = self.type;
        admin
          .messaging()
          .send(message)
          .then(
            function(response) {
              self.updateAttributes(
                { status: "sent", fcmresponse: response },
                options,
                function() {}
              );
            },
            function(error) {
		if (error) {
			console.log('fcm error ' , error);
		}
              if (
                error.code == "messaging/registration-token-not-registered" &&
                messageForUserId
              ) {
                console.log("Error code ", error.code, message.token);
                updateAttributes(
                  { status: "Device Token in invalid" },
                  options,
                  function() {}
                );
              }
            }
          )
          .catch(function(error) {
            console.log("Error sending message:", error);
            cb(error, null);
          });
      }
      else {
	console.log('no device token in fcm');
	}
  };
  FCM.observe("before save", function(ctx, next) {
    if (ctx.isNewInstance && ctx.instance) {
	var now = new Date();
	ctx.instance.time = now.getTime();
	if (ctx.instance.userName) {
      var AppUser = loopback.getModelByType("AppUser");
      var filter = {
        where : {
          username : ctx.instance.userName
        }
      };
      AppUser.findOne(filter, ctx.options, function(err, user) {
        if (!user) {
          return next();
        }
        ctx.instance.userId = user.id;
        if (!ctx.instance.deviceToken && user.deviceToken) {
		console.log('update device token from user ', user.deviceToken);
          ctx.instance.deviceToken = user.deviceToken;
        }
	       next();
      });
      }
      else {
      next();    
	}
    } else {
      next();    
    }   
  });

  FCM.observe("after save", function(ctx, next) {
    if (ctx.instance && ctx.isNewInstance) {
      setImmediate(function() {
        ctx.instance.process(ctx.options);
      });
    }
    next();
  });

  var serviceKeyPath = path.join(
    process.env.HOME,
    "fcmkey/serviceAccountKey.json"
  );

  var serviceAccount = require(serviceKeyPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "myteam-8d547",
    databaseURL: "https://myteam-8d547.firebaseio.com"
  });

  FCM.enable = function(options, cb) {
    FCM.status = "enable";
    cb(null, {});
  };

  FCM.disable = function(options, cb) {
    FCM.status = "disable";
    cb(null, {});
  };

  FCM.status = "enable";

  FCM.push = function(message, options, cb) {
    if (FCM.status == "disable") {
      return cb(null, {});
    }
    var messageForUserId;
    if (message.data && message.data.messageForUserId) {
      messageForUserId = message.data.messageForUserId;
    }
    admin
      .messaging()
      .send(message)
      .then(
        function(response) {
          // Response is a message ID string.
          cb(null, response);
        },
        function(error) {
          if (
            error.code == "messaging/registration-token-not-registered" &&
            messageForUserId
          ) {
            console.log("Error code ", error.code, message.token);
            var UserModel = loopback.getModelByType("User");
            UserModel.findById(messageForUserId, options, function(err, user) {
              if (user) {
                console.log("clear deviceToken from users ", user.username);
                user.updateAttributes({ deviceToken: "" }, option, function(
                  err,
                  dbrec
                ) {
                  console.log(
                    "deviceToken cleared for ",
                    user.username,
                    err,
                    dbrec.username
                  );
                });
              }
            });
          }
          cb(error, null);
        }
      )
      .catch(function(error) {
        console.log("Error sending message:", error);
        cb(error, null);
      });
  };

  FCM.remoteMethod("push", {
    description: "Push the message",
    accessType: "WRITE",
    accepts: [
      {
        arg: "data",
        type: "object",
        description: "Model instance data",
        http: { source: "body" }
      }
    ],
    http: {
      verb: "POST",
      path: "/"
    },
    returns: {
      type: "object",
      root: true
    }
  });

  FCM.ulist = function(options, cb) {
    var response = [];
    var AppUser = loopback.getModelByType("AppUser");
    AppUser.find({}, options, function(err, userlist) {
      async.forEach(
        userlist,
        function(user, done) {
          var item = {
            userId: user.id,
            username: user.username,
            email: user.email,
            deviceToken: user.deviceToken
          };
          var AuthSession = loopback.getModelByType("AuthSession");
          AuthSession.find(
            { where: { userId: user.id }, limit: 1, order: "created DESC" },
            options,
            function(err, list) {
              if (list.length > 0) {
                item.authToken = list[0].id;
                item.lastLogin = list[0].created;
              }
              response.push(item);
              done(null);
            }
          );
        },
        function() {
          cb(null, response);
        }
      );
    });
  };

  FCM.remoteMethod("ulist", {
    description: "for demo",
    accessType: "READ",
    accepts: [],
    http: {
      verb: "GET",
      path: "/ulist"
    },
    returns: {
      type: "object",
      root: true
    }
  });

  FCM.remoteMethod("enable", {
    description: "for demo",
    accessType: "READ",
    accepts: [],
    http: {
      verb: "GET",
      path: "/enable"
    },
    returns: {
      type: "object",
      root: true
    }
  });

  FCM.remoteMethod("disable", {
    description: "for demo",
    accessType: "READ",
    accepts: [],
    http: {
      verb: "GET",
      path: "/disable"
    },
    returns: {
      type: "object",
      root: true
    }
  });
};
