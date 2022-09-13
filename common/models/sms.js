var moment = require("moment-timezone");

module.exports = function(SMS) {
  SMS.observe("before save", function(ctx, next) {
    if (ctx.isNewInstance && ctx.instance) {
      ctx.instance.created = new Date();
      ctx.instance.userId = ctx.instance.userId || ctx.options.ctx.userId;
      ctx.instance.name = ctx.instance.name || ctx.options.ctx.username;
      ctx.instance.createdBy = ctx.options.ctx.userId;
    }
    next();
  });

  var ONE_HOUR = 3600000;

  var updateSwipeData = function(self, date, options) {
    // insert or update swipe data
    SwipeData = loopback.getModelByType("SwipeData");
    var time = date.getTime();
    var userId = self.userId;
    var d1 = moment(time).tz("Asia/Calcutta");
    var yyyymmdd = d1.format("YYYYMMDD");
    var filter = { where: { yyyymmdd: yyyymmdd, userId: userId } };
    SwipeData.findOne(filter, options, function(err, dbrec) {
      if (dbrec) {
        if (time == dbrec.swipeInTime || time == dbrec.swipeOutTime) {
          // ignore
        } else {
          var upd = {};
          if (dbrec.swipeInTime == 0) {
            // first swipe
            if (date.getHours() <= 15) {
                 // normal swip in
                upd.swipeInTime = time;
            }
            else if (dbrec.swipeOutTime == 0) {
              upd.swipeOutTime = time;
            } else if (time > dbrec.swipeOutTime) {
               upd.swipeOutTime = time;
            } else {
              // multiple swipes 
              upd.statusRemarks = "multiple swipes?";
            }
          }
          else if (dbrec.swipeOutTime > 0 ) {
              // swipe after swipe out
              if (time > dbrec.swipeOutTime) {
                upd.swipeOutTime = time;
              }
          } else if (time < dbrec.swipeInTime) {
                upd.swipeInTime = time;
          } else if (time - dbrec.swipeInTime > ONE_HOUR) {
                upd.swipeOutTime = time;
          } else {
            upd.statusRemarks = "multiple swipes?";
          }
          dbrec.updateAttributes(upd, options, function(err, updrec) {
            if (err) console.log("could not update swipe data", dbrec.id);
          });
        }
      } else {
        var data = {
          yyyymmdd: yyyymmdd,
          userId: userId,
          swipeInTime: time,
          name: self.name,
          statusRemarks: "Have a good day"
        };
        SwipeData.create(data, options, function(err, newrec) {
          if (err) console.log("swipe data insert error", err);
          if (newrec) console.log("swipe data created", newrec.id);
        });
      }
    });
  };

  SMS.observe("after save", function(ctx, next) {
    next();

    if (!ctx.isNewInstance) {
      return;
    }
    if (!ctx.instance) {
      return;
    }

    var message = ctx.instance.text;
    var pos = message.indexOf("Punched on: ");
    if (pos >= 0 && message.length > pos + 23) {
      var year = message.substring(pos + 18, pos + 22);
      var month = message.substring(pos + 15, pos + 17);
      month = month - 1;
      var day = message.substring(pos + 12, pos + 14);
      var hour = message.substring(pos + 27, pos + 29);
      var mins = message.substring(pos + 30, pos + 32);
      var d1 = new Date(year, month, day, hour, mins, 0);
	var swipeTime = new Date(d1.getTime() - 19800000);
      console.log("Punched time ", swipeTime);
      updateSwipeData(ctx.instance, swipeTime, ctx.options);
    } else {
      console.log("Punched on: missing");
    }
  });
};
