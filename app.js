//Required modules
const ipfsAPI = require('ipfs-api');
const express = require('express');
const fs = require('fs');
const User = require("./models/user");
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require("passport");
const methodOverride = require('method-override');
const expressSanitizer = require("express-sanitizer");
const fileUpload = require('express-fileupload');
const flash = require('connect-flash');
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose")
const path = require('path')
const request = require('request')
const nodeMailer = require('nodemailer')
const app = express();
const ipfs = ipfsAPI('ipfs.infura.io', '5001', {
  protocol: 'https'
})


//mongoose
mongoose.connect("mongodb://anup:dolly23@ds217452.mlab.com:17452/ipfs");


app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(flash());
app.use(expressSanitizer());
app.use(methodOverride("_method"));
app.use(express.static("public"));
app.use(fileUpload());
app.use(express.static(__dirname + "/public"));
app.use(require("express-session")({
  secret: "Rusty is the best and cutest dog in the world",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//variables
let testFile;
let testBuffer;

//schema
var FileSchema = new mongoose.Schema({
  user_id: String,
  name: String,
  path: String,
  //  name: String,
  // path: String,
});

//model
var File = mongoose.model("File", FileSchema);


//user-routes
app.get('/', function (req, res) {
  res.render('login');
});

app.post('/addfile/:id', isLoggedIn, function (req, res) {
  let sampleFile;
  let uploadPath;
  if (Object.keys(req.files).length == 0) {
    res.status(400).send('No files were uploaded.');
    return;
  } else {
    console.log('req.files >>>', req.files); // eslint-disable-line
    sampleFile = req.files.sampleFile;
    uploadPath = __dirname + '/uploads/' + sampleFile.name;
    sampleFile.mv(uploadPath, function (err) {
      if (err) {
        return res.status(500).send(err);
      } else {
        testFile = fs.readFileSync(uploadPath);
        testBuffer = new Buffer(testFile);
        ipfs.add(testBuffer, function (err, file) {
          if (err) {
            console.log(err);
          }
          console.log(file)
          var file_path = file[0].path
          var file_name = sampleFile.name
          var id = req.params.id
          File.create({
            user_id: id,
            name: file_name,
            path: file_path
          })
          res.redirect('/all/' + id);
        })
      }
    });
  }
});

app.get('/all/:id', isLoggedIn, function (req, res) {
  var userId = req.params.id
  File.find({
    user_id: userId
  }, function (err, allfiles) {
    if (err) {
      console.log(err);
    } else {
      res.render("all", {
        fileArray: allfiles
      });
    }
  });
});

app.get('/getfile', isLoggedIn, function (req, res) {
  const validCID = 'QmQVAmLNFt7nqpx4psf6qZX2opa8QZmMsxVdfjMP49ujuR';
  res.redirect("https://gateway.ipfs.io/ipfs/" + validCID);
})



///Auth
// Auth Routes
//show sign up form
app.get("/register", function (req, res) {
  res.render("register");
});

//handling user sign up
app.post("/register", function (req, res) {
  captcha = req.body['g-recaptcha-response']
  console.log(captcha)
  if (captcha === undefined || captcha === '' || captcha === null) {
    return res.json({
      "success": false,
      "msg": "Please select captcha"
    });
  }

  // Secret Key
  const secretKey = '6LdjLJgUAAAAAHTeBvDz2Y8ceZHNgx2dHLJfZiL5';

  // Verify URL
  const verifyUrl = `https://google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captcha}&remoteip=${req.connection.remoteAddress}`;

  // Make Request To VerifyURL
  request(verifyUrl, (err, response, body) => {
    body = JSON.parse(body);
    console.log(body);

    // If Not Successful
    console.log(body.success)
    if (body.success !== undefined && !body.success) {
      return res.json({
        "success": false,
        "msg": "Failed captcha verification"
      });
    }
    if (req.body.password == req.body.c_password) {
      console.log(req.body)
      User.register(new User({
        username: req.body.username,
        name: req.body.name,
      }), req.body.password, function (err, user) {
        if (err) {
          console.log(err);
          return res.render('register');
        }
        passport.authenticate("local")(req, res, function () {
          res.redirect("/login");
        });
      });
    } else {
      res.send('Password dosent Match');
    }
  });
});




// LOGIN ROUTES
//render login form
app.get("/login", function (req, res) {
  res.render("login");
});
app.get('/index/:id', function (req, res) {
  id = req.params.id
  res.render('index', {
    id: id
  });
});
//login logic
//middleware
// app.post("/login", passport.authenticate("local", {
//   successRedirect: "/index",
//   failureRedirect: "/login"
// }), function(req, res) {
//   username = req.body.username;
//   console.log(username);
// });
app.post("/login",
  passport.authenticate("local", {
    failureFlash: true
  }),
  function (req, res) {
    console.log(req.user)
    res.redirect('/index/' + req.user._id);
  });



app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

//mailing service

app.post('/send-email', function (req, res) {
  console.log(req.body.body1);
  let transporter = nodeMailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'fileshare.ipfs@gmail.com',
      pass: 'raquaza123'
    }
  });
  let mailOptions = {
    from: '"FileShare" <fileshare.ipfs@gmail.com>', // sender address
    to: req.body.to, // list of receivers
    subject: req.body.subject, // Subject line
    text: req.body.body1, // plain text body
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Message %s sent: %s', info.messageId, info.response);
    res.render('index');
  });
});


app.listen(3000, () => console.log('App listening on port 3000!'))