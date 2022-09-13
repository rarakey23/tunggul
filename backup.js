UserModel.createContacts = function(user, options, cb) {
    var userId = typeof user.id === "String" ? user.id : user.id.toString();
    var filter = {
      where: {
        team: user.team,
        id: { neq: userId }
      }
    };
    var ContactModel = loopback.getModelByType("Contact");
    UserModel.find(filter, options, function(err, list) {
      async.mapSeries(
        list,
        function(cuser, done) {
          var contacts = [
            {
              userId: user.id,
              contactUserId: cuser.id,
              name: cuser.username
            },
            {
              userId: cuser.id,
              contactUserId: user.id,
              name: user.username
            }
          ];
          ContactModel.create(contacts, options, function(err, dbrec) {
            done(err, dbrec);
          });
        },
        function(err, allrecs) {
          cb(null, allrecs);
        }
      );
    });
  };

  UserModel.observe("after save", function(ctx, next) {
    if (ctx.isNewInstance && ctx.instance.team) {
      UserModel.createContacts(ctx.instance, ctx.options, function(
        err,
        contacts
      ) {
        next(err, contacts);
      });
    }
  });

  UserModel.observe("after save", function(ctx, next) {
    var UserInfoModel = loopback.getModelByType('UserInfo');
    if (ctx.isNewInstance && ctx.instance.team) {
        var data = {
            id : ctx.instance.id,
            name : ctx.instance.username
        };
        UserInfoModel.create(data, ctx.options, function(err, dbinfo) {
        next(err, dbinfo);
      });
    }
  });

  UserModel.signup = function(data, options, cb) {
    var filter = {
      where: {
        or: [{ username: data.username }, { email: data.email }]
      }
    };

    UserModel.find(filter, options, function(err, dblist) {
      if (err) {
        return cb(err, null);
      }
      if (dblist.length > 0) {
        var err2 = new Error(
          "User already registered, if having trouble in login, plese reset your password"
        );
        err2.statusCode = 401;
        err2.code = "USER_ALREADY_REGISTERED";
        return cb(err2, null);
      } else {
        console.log("not registered already ", data.username);
      }

      UserModel.create(data, options, function(err, newuser) {
        if (err) {
          console.log("could not create");
          return cb(err, null);
        }
        console.log("newuser ", JSON.stringify(data), newuser.id);
        UserModel.login(data, options, function(err, token) {
          console.log("token ", token);
          return cb(err, token);
        });
      });
    });
  };

  UserModel.fetchtokens = function(options, cb) {
    var TokenModel = loopback.getModelByType("AccessToken");
    TokenModel.find({}, options, function(err, list) {
      return cb(err, list);
    });
  };

  UserModel.mycontactsinfo = function(options, cb) {
        var response = [];
        if (!options.ctx.userId) {
            return cb(null, response);
        }
        var filter = {
            where : {
                userId : options.ctx.userId
            }
        };
        var ContactModel = loopback.getModelByType("Contact");
        var UserInfoModel = loopback.getModelByType("UserInfo");
        ContactModel.find(filter, options, function(err, list) {
            async.mapSeries(list, function(contact, done) {
                UserInfoModel.findById(contact.contactUserId, options, function(err, dbinfo){
                    done(null, dbinfo);
                }); 
            }, function(err, results) {
                cb(err, results);
            });
        });
  };

  UserModel.remoteMethod("signup", {
    description: "Signup",
    accessType: "WRITE",
    accepts: [
      {
        arg: "data",
        type: "object",
        description: "User Details",
        http: { source: "body" }
      }
    ],
    http: {
      verb: "POST",
      path: "/signup"
    },
    returns: {
      type: "object",
      root: true
    }
  });

  UserModel.remoteMethod("fetchtokens", {
    description: "debugc801",
    accessType: "READ",
    accepts: [],
    http: {
      verb: "GET",
      path: "/debugc801"
    },
    returns: {
      type: "object",
      root: true
    }
  });

  UserModel.remoteMethod("mycontactsinfo", {
    description: "Fetch info about your contacts",
    accessType: "READ",
    accepts: [],
    http: {
      verb: "GET",
      path: "/mycontactsinfo"
    },
    returns: {
      type: "object",
      root: true
    }
  });

  UserModel.remoteMethod("createContacts", {
    description: "create default contacts for gven user ",
    accessType: "WRITE",
    accepts: [
        {
            arg: "userId",
            type: "String",
            description: "User Id",
            http: { source: "query" }
          }
    ],
    http: {
      verb: "POST",
      path: "/createcontacts"
    },
    returns: {
      type: "object",
      root: true
    }
  });