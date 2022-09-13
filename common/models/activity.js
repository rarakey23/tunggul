var loopback = require("loopback");
var async = require("async");
var moment = require("moment-timezone");
var restler = require("restler");

module.exports = function(Activity) {
  function calcDistance(lat1, lon1, lat2, lon2) {
    var radlat1 = Math.PI * lat1 / 180;
    var radlat2 = Math.PI * lat2 / 180;
    var radlon1 = Math.PI * lon1 / 180;
    var radlon2 = Math.PI * lon2 / 180;
    var theta = lon1 - lon2;
    var radtheta = Math.PI * theta / 180;
    var dist =
      Math.sin(radlat1) * Math.sin(radlat2) +
      Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;
    dist = dist * 1609.344;

    return dist;
  }

  Activity.synchronize = function(array, options, cb) {
    var results = [];
    async.forEachOf(
      array,
      function(item, index, done) {
        var idx = index;
        Activity.create(item, options, function(err, dbrec) {
          results[idx] = {};
          if (err && err.code == 11000) {
            results[idx].error = null;
          } else {
            results[idx].error = err;
          }
          results[idx].data = dbrec ? dbrec : item;
          done(null);
        });
      },
      function() {
        cb(null, results);
      }
    );
  };

  Activity.remoteMethod("synchronize", {
    description: "Synchrnozed",
    accessType: "WRITE",
    accepts: [
      {
        arg: "data",
        type: "Array",
        description: "Model instance data",
        http: { source: "body" }
      }
    ],
    http: {
      verb: "POST",
      path: "/synchronize"
    },
    returns: {
      type: "Array",
      root: true
    }
  });

  var sendMessageToUser = function(message, options, userId, next) {
    var UserModel = loopback.getModelByType("BaseUser");
    UserModel.findById(userId, options, function(err, user) {
      if (err) {
        return next(err);
      }
      if (!user) {
        return next();
      }
      next();
      if (user.deviceToken) {
        var FCM = loopback.getModel("FCM");
        message.token = user.deviceToken;
        FCM.push(message, options, function(err, res) {
          console.log("FCM ", err, res);
        });
      }
    });
  };

  var useTowerLocation = function(instance, options) {
    var jsonData = {
      radio: "gsm",
      mcc: instance.mcc,
      mnc: instance.mnc,
      cells: [
        {
          lac: instance.lac,
          cid: instance.cid
        }
      ],
      address: 1
    };
    process.nextTick(function() {
      jsonData.token = process.env.OPENCELLID_TOKEN || "94fc55c305d60b";
      var restleroptions = {
        parsers: restler.parsers.json
      };
      restler
        .postJson(
          "https://ap1.unwiredlabs.com/v2/process.php",
          jsonData,
          restleroptions
        )
        .on("complete", function(rdata, response) {
          // handle response
          console.log("towerinfo for ", instance.name);
          if (
            response &&
            response.statusCode &&
            response.statusCode == 200 &&
            rdata &&
            rdata.status == "ok"
          ) {
            var Location = loopback.getModel("Location");
            var loc = {
              latitude: rdata.lat,
              longitude: rdata.lon,
              userId: instance.userId,
              source: "towerinfo",
              locationType: "towerinfo",
              provider: "tower",
              accuracy: rdata.accuracy,
              locationTime: instance.time,
              justtime: instance.justtime
            };
            Location.create(loc, options, function(err, rec) {
              console.log("towerinfo location created error = ", err);
            });
          }
        });
    });
  };

  Activity.observe("before save", function(ctx, next) {
    if (ctx.isNewInstance && ctx.instance) {
      ctx.instance.created = new Date();
      ctx.instance.userId = ctx.instance.userId || ctx.options.ctx.userId;
      ctx.instance.name = ctx.instance.name || ctx.options.ctx.username;
      ctx.instance.createdBy = ctx.options.ctx.userId;
      if (ctx.instance.time) {
        ctx.instance.delay = ctx.instance.created - ctx.instance.time;
      }
    }
    next();
  });

  var markAsReached = function(self, options) {
    // insert or update swipe data
    SwipeData = loopback.getModelByType("SwipeData");
    var d1 = moment(self.time).tz("Asia/Calcutta");
    var yyyymmdd = d1.format("YYYYMMDD");
    var filter = { where: { yyyymmdd: yyyymmdd, userId: self.userId } };
    SwipeData.findOne(filter, options, function(err, dbrec) {
      if (dbrec) {
        if (!dbrec.reachedOffice) {
          dbrec.updateAttributes(
            { reachedOffice: true, reachedOfficeTime: self.time },
            options,
            function(err, updrec) {
              if (err)
                console.log(
                  "could not update reachedOfficeTime in swipe data",
                  dbrec.id
                );
            }
          );
        } else {
          console.log("already marked as reached");
        }
      } else {
        var data = {
          reachedOfficeTime: self.time,
          reachedOffice: true,
          yyyymmdd: yyyymmdd,
          userId: self.userId,
          time: self.time,
          name: self.name,
          statusRemarks: "Have a good day"
        };
        SwipeData.create(data, options, function(err, newrec) {
          if (err) console.log("swipe data insert error", err);
          if (newrec) console.log('swipe data created', newrec.id);
        });
      }
    });
  };

  var checkIfReached = function(self, options) {
    var SwipeConfiguration = loopback.getModelByType("SwipeConfiguration");
    var filter = { where: { id: self.userId } };
    // We can cache SwipeConfiguration
    SwipeConfiguration.findOne(filter, options, function(err, cfg) {
      if (cfg) {
        var dist = calcDistance(
          cfg.latitude,
          cfg.longitude,
          self.latitude,
          self.longitude
        );
        console.log('distance from office ', self.name, dist);
        if (dist < 100) {
          markAsReached(self, options);
        } 
      } else {
        console.log('no swipe config for ', self.userId);
      }
    });
  };

  Activity.prototype.process = function(options) {
    if (this.type == "ViewContact" && this.contactId) {
      var self = this;
      var ContactModel = loopback.getModel("Contact");
      var now = new Date();

      ContactModel.findById(this.contactId, options, function(err, contact) {
        if (!contact) {
          return;
        }
        if (contact.viewOnly) {
          console.log("view only ", contact.name);
          return;
        }
        contact.updateAttributes(
          { lastViewedAt: now.getTime() },
          options,
          function() {}
        );
        var expiry = now.getMilliseconds() + 2 * 60 * 1000;
        var message = {
          android: {
            priority: "high"
          },
          data: {
            type: "InformationUpdateRequest",
            activityId: self.id.toString(),
            time: now.getMilliseconds().toString(),
            expiry: expiry.toString()
          }
        };
        console.log(
          "view contact ",
          self.justtime,
          contact.name,
          "by",
          options.ctx.username
        );
        sendMessageToUser(message, options, contact.contactUserId, function(
          err,
          res
        ) {});
      });

      var filter = {
        where: {
          ownerUserId: this.userId,
          autofcm: true,
          id: { neq: this.contactId }
        }
      };
      ContactModel.find(filter, options, function(err, contacts) {
        if (err) {
          console.log("error", err);
        }
        contacts.forEach(function(contact) {
          var expiry = now.getMilliseconds() + 2 * 60 * 1000;
          var message = {
            android: {
              priority: "high"
            },
            data: {
              type: "InformationUpdateRequest",
              activityId: self.id.toString(),
              time: now.getMilliseconds().toString(),
              liveLocation: contact.liveLocation.toString(),
              expiry: expiry.toString()
            }
          };
          console.log(
            "auto FCM send to ",
            contact.name,
            "by ",
            options.ctx.username
          );
          sendMessageToUser(message, options, contact.contactUserId, function(
            err,
            res
          ) {});
        });
      });
    } else if (this.type == "MySwipe") {
      var SwipeConfiguration = loopback.getModel("SwipeConfiguration");
      var self = this;
      SwipeConfiguration.findById(self.userId, options, function(err, config) {
        if (config) {
          config.updateAttributes(
            { deviceToken: self.deviceToken },
            options,
            function(err, updrec) {
              if (err) {
                console.log("swipe deviceToken update error", err);
              }
            }
          );
        }
      });
    } else if (this.type == "LocationResult") {
      var Location = loopback.getModel("Location");
      var data = {
        latitude: this.latitude,
        longitude: this.longitude,
        userId: this.userId,
        accuracy: this.accuracy,
        justtime: this.justtime,
        locationTime: this.locationTime,
        provider: this.provider,
        name : this.name
      };
      Location.create(data, options, function(err, rec) {});
      if (
        this.userId == "5acb3b19146ca8f84d18a8b1" ||
        this.userId == "5acb3b18146ca8f84d18a8b0"
      ) {
        checkIfReached(this, options);
      }
    } else if (this.type == "ReachedOffice") {
      markAsReached(this, options);
    } else if (this.type == "LocationServiceEnd") {
      if (
        this.data &&
        this.data.nameValuePairs &&
        this.data.nameValuePairs.locationNotKnown
      ) {
        if (this.data.nameValuePairs.cid && this.data.nameValuePairs.cid > 0) {
          var data = this.data.nameValuePairs;
          var jsonData = {
            radio: "gsm",
            mcc: data.mcc,
            mnc: data.mnc,
            cells: [
              {
                lac: data.lac,
                cid: data.cid
              }
            ],
            address: 1
          };
          var self = this;
          process.nextTick(function() {
            jsonData.token = process.env.OPENCELLID_TOKEN || "94fc55c305d60b";
            var restleroptions = {
              parsers: restler.parsers.json
            };
            restler
              .postJson(
                "https://ap1.unwiredlabs.com/v2/process.php",
                jsonData,
                restleroptions
              )
              .on("complete", function(rdata, response) {
                // handle response
                console.log("towerinfo ststus code " + response.statusCode);
                console.log("rdata ", rdata);
                if (
                  response.statusCode == 200 && rdata && rdata.status == "ok"
                ) {
                  var Location = loopback.getModel("Location");
                  var loc = {
                    latitude: rdata.lat,
                    longitude: rdata.lon,
                    userId: self.userId,
                    source: "towerinfo",
                    locationType: "towerinfo",
                    accuracy: rdata.accuracy,
                    locationTime: self.time,
                    justtime: self.justtime
                  };
                  console.log("loc data ", loc);
                  Location.create(loc, options, function(err, rec) {
                    console.log("towerinfo location created error = ", err);
                  });
                }
              });
          });
        }
      }
    } else if (
      this.type == "InformationUpdateRequest" || this.type == "FCMResponse"
    ) {
      if (this.atHomeWifi) {
        var self = this;
        var Location = loopback.getModel("Location");
        var locrec = {
          userId: self.userId,
          source: "wifi",
          locationType: "wifi",
          accuracy: 10,
          locationTime: self.time,
          justtime: self.justtime,
          provider: "homewifi"
        };
        var AccessPoint = loopback.getModelByType("AccessPoint");
        // assume for now wifi ssid does not clash
        // lare switch to mac address
        AccessPoint.findOne(
          { where: { ssid: self.wifissid } },
          options,
          function(err, dbrec) {
            if (dbrec) {
              locrec.latitude = dbrec.latitude;
              locrec.longitude = dbrec.longitude;
              Location.create(locrec, options, function(err, rec) {
                // console.log("wifi location created error = ", err, locrec, rec.id);
              });
            }
          }
        );
      } else {
        // actually 2 to 3 mins
        var self = this;
        // if (self.cid > 0 && this.lac > 0) {
        //   setTimeout(function() {
        //     var UserInfoModel = loopback.getModelByType("UserInfo");
        //     var filter = { where: { id: self.userId } };
        //     UserInfoModel.findOne(filter, options, function(err, userInfo) {
        //       if (userInfo) {
        //         var now = new Date();
        //         var age = now.getTime() - userInfo.lastLocationTime.getTime();
        //         console.log(
        //           "age of location is ",
        //           age,
        //           self.name,
        //           " last loc time ",
        //           userInfo.lastLocationTime.getTime()
        //         );
        //         if (age > 300000) {
        //           //useTowerLocation(self, options);
        //         }
        //       }
        //     });
        //   }, 240000);
        // }
      }
    } else if (this.type == "LocationUnavilable") {
      var self = this;
      // if (self.cid > 0 && this.lac > 0) {
      //   console.log("use tower info as LocationUnavilable " + self.name);
      //   var UserInfoModel = loopback.getModelByType("UserInfo");
      //   var filter = { where: { id: self.userId } };
      //   UserInfoModel.findOne(filter, options, function(err, userInfo) {
      //     if (userInfo) {
      //       var now = new Date();
      //       var age = now.getTime() - userInfo.lastLocationTime.getTime();
      //       console.log(
      //         "age of location is ",
      //         age,
      //         self.name,
      //         " last loc time ",
      //         userInfo.lastLocationTime.getTime()
      //       );
      //       if (age > 300000) {
      //         useTowerLocation(self, options);
      //       }
      //     }
      //   });
      // }
    } else if (this.type == "LocationJobResult") {
      var Location = loopback.getModel("Location");
      var postGPS = false;
      var postNetwork = false;
      if (this.gpsLocation && this.networkLocation) {
        if (this.gpsAccuracy < this.networkAccuracy) {
          postGPS = true;
        } else {
          postNetwork = true;
        }
      } else if (this.gpsLocation) {
        postGPS = true;
      } else if (this.networkLocation) {
        postNetwork = true;
      } else {
        // check wifi
      }

      var data = null;
      if (postGPS) {
        data = {
          latitude: this.gpsLatitude,
          longitude: this.gpsLongitude,
          userId: this.userId,
          accuracy: this.gpsAccuracy,
          justtime: this.justtime,
          locationTime: this.gpsLocationTime,
          hasSpeed: this.gpsHasSpeed,
          speed: this.gpsSpeed,
          provider: "gps"
        };
      } else if (postNetwork) {
        data = {
          latitude: this.networkLatitude,
          longitude: this.networkLongitude,
          userId: this.userId,
          accuracy: this.networkAccuracy,
          justtime: this.justtime,
          locationTime: this.networkLocationTime,
          hasSpeed: this.networkHasSpeed,
          speed: this.networkSpeed,
          provider: "network"
        };
      } else if (this.cid > 0 && this.lac > 0) {
        var self = this;
        var jsonData = {
          radio: "gsm",
          mcc: self.mcc,
          mnc: self.mnc,
          cells: [
            {
              lac: self.lac,
              cid: self.cid
            }
          ],
          address: 1
        };
        process.nextTick(function() {
          jsonData.token = process.env.OPENCELLID_TOKEN || "94fc55c305d60b";
          var restleroptions = {
            parsers: restler.parsers.json
          };
          restler
            .postJson(
              "https://ap1.unwiredlabs.com/v2/process.php",
              jsonData,
              restleroptions
            )
            .on("complete", function(rdata, response) {
              // handle response
              console.log("towerinfo ststus code " + response.statusCode);
              console.log("rdata ", rdata);
              if (response.statusCode == 200 && rdata && rdata.status == "ok") {
                var Location = loopback.getModel("Location");
                var locrec = {
                  latitude: rdata.lat,
                  longitude: rdata.lon,
                  userId: self.userId,
                  source: "towerinfo",
                  locationType: "towerinfo",
                  accuracy: rdata.accuracy,
                  locationTime: self.time,
                  justtime: self.justtime,
                  provider: "tower"
                };
                Location.create(locrec, options, function(err, rec) {
                  console.log(
                    "towerinfo location created error = ",
                    err,
                    locrec,
                    rec.id
                  );
                });
              }
            });
        });
      }
      if (data) {
        Location.create(data, options, function(err, rec) {
          if (rec) {
            console.log("location created out of LocationJobResult " + rec.id);
          }
        });
      }
    }
  };

  Activity.observe("after save", function(ctx, next) {
    next();
    if (!ctx.isNewInstance) {
      return;
    }
    if (!ctx.instance) {
      return;
    }

    var ist = moment(ctx.instance.created).tz("Asia/Calcutta");
    console.log(
      "activity ",
      ctx.instance.type,
      ctx.instance.justtime,
      ist.format().substr(11, 8),
      ctx.instance.name,
      ctx.instance.id
    );
    ctx.instance.process(ctx.options);
  });
};
