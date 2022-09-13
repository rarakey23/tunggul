var rest = require("restler");

var data = instance.data.nameValuePairs;

if (data.cid > 0) {
var jsonData = {
  radio : "gsm",
  mcc : data.mcc,
  mnc : data.mnc,
  cells : [ {
      lac : data.lac,
      cid : data.cid
  }
  ],
  address : 1
};
}

jsonData.token = process.env.OPENCELLID_TOKEN;

var options = {
  parsers : rest.parsers.json
};

rest
  .postJson("https://ap1.unwiredlabs.com/v2/process.php", jsonData, options)
  .on("complete", function(data, response) {
    // handle response
    console.log(response.statusCode);

    if (data) {
      console.log('data ', data);
      console.log('ok? ', data.status);
      console.log('lat ', data.lat);
    }
    if (response) {
        console.log(Object.keys(response));
    }
});
