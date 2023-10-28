import React from 'react';
import './App.css';

var tryJSON = x => {try{JSON.parse(x);return true;}catch(e){return false;}} // check JSON validity

class ServerInterface {
  constructor(host) {
    this.state = {
      recaptcha: null, // recaptcha site_key
      auth: null, // auth token
      accountData: null, // fresh account data from ws
      currentUser: null, // current selected user
      connected: false, // connected to WS
      host: host || "localhost:1414" // server address
    };

    this.onReadyForAuth = () => {}
    this.onError = err => {}
    this.onAuthError = err => {};
    this.onLoggedIn = () => {};
  }

  start() {
    var captcha = new XMLHttpRequest();
    captcha.open('GET', 'http://' + this.state.host + '/auth/recaptcha.json', true);

    captcha.onload = function onCaptchaLoad() {
      if (captcha.status === 200) {
        if (!tryJSON(captcha.response)) {
          console.error("Error when requesting captcha data (response not JSON)", captcha.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        var o = JSON.parse(captcha.response);

        if (!o.site_key) {
          console.error("Error when requesting captcha data (site_key missing from 200)", captcha.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        this.state.recaptcha = o.site_key;

        this.onReadyForAuth();
      } else if (captcha.status === 404) {
        if (!tryJSON(captcha.response)) {
          console.error("Error when requesting captcha data (response not JSON)", captcha.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        this.onReadyForAuth();
      } else if (captcha.status !== 404) {
        console.error("Error when requesting captcha data", captcha.status, captcha.response);
        this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
      }
    }.bind(this)

    captcha.onerror = function onCaptchaError(err) {
      console.error("Error when requesting captcha data", err);
      this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
    }.bind(this)
    
    captcha.send();
  }

  register(username, password, recaptcha) {
    var rxhr = new XMLHttpRequest();
    rxhr.open('POST', 'http://' + this.status.host + "/auth/register.json");
    rxhr.setRequestHeader('Content-Type', 'application/json');

    rxhr.onload = function onRegisterLoad() {
      if (rxhr.status === 200) {
        if (!tryJSON(rxhr.response)) {
          console.error("Error when trying to register (response not JSON)", rxhr.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        this.login(username, password);
      } else if (rxhr.status === 400) {
        if (!tryJSON(rxhr.response)) {
          console.error("Error when trying to register (response not JSON)", rxhr.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        var o = JSON.parse(rxhr.response);

        if (!o.error) {
          console.error("Error when trying to register (couldn't find error code property)", rxhr.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        if (o.error === 1) return this.onAuthError("Incorrect reCAPTCHA. Please try again.")
        if (o.error === 3) return this.onAuthError("That username is unavailable.")
        if (o.error === 4) return this.onAuthError("Your password doesn't fit our requirements. It must be longer than 8 characters, but shorter than 129 characters.")
        if (o.error === 5) return this.onAuthError("Your username doesn't fit our requirements. It must only contain alphanumerical characters, underscores and dashes.")

        console.error("Error when trying to register (unhandled error)", rxhr.status, rxhr.response);
        this.onError("An error occurred while trying to register.\nAre you sure your host is a Signal server, and is up to date?");
      } else {
        console.error("Error when trying to register", rxhr.status, rxhr.response);
        return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
      }
    }.bind(this);

    rxhr.onerror = function onRegisterError(err) {
      console.error("Error when trying to register", err);
      this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
    }.bind(this)

    rxhr.send(JSON.stringify({
      username,
      password,
      "g-recaptcha-response": recaptcha
    }));
  }

  login(username, password) {
    var lxhr = new XMLHttpRequest();
    lxhr.open('POST', 'http://' + this.status.host + "/auth/login.json")
    lxhr.setRequestHeader('Content-Type', 'application/json');

    lxhr.onload = function onRegisterLoad() {
      if (lxhr.status === 200) {
        if (!tryJSON(lxhr.response)) {
          console.error("Error when trying to login (response not JSON)", lxhr.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        var o = JSON.parse(lxhr.response);

        if (!o.token) {
          console.error("Error when trying to login (didn't send token)", lxhr.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        this.state.auth = o.token;

        this.startWS();
      } else if (lxhr.status === 400) {
        if (!tryJSON(lxhr.response)) {
          console.error("Error when trying to login (response not JSON)", lxhr.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        var o = JSON.parse(lxhr.response);

        if (!o.error) {
          console.error("Error when trying to login (couldn't find error code property)", lxhr.response);
          return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
        }

        if (o.error === 3) return this.onAuthError("No account exists by that username.")
        if (o.error === 4) return this.onAuthError("Incorrect password.")

        console.error("Error when trying to login (unhandled error)", lxhr.status, lxhr.response);
        this.onError("An error occurred while trying to register.\nAre you sure your host is a Signal server, and is up to date?");
      } else {
        console.error("Error when trying to login", lxhr.status, lxhr.response);
        return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
      }
    }.bind(this);

    lxhr.onerror = function onRegisterError(err) {
      console.error("Error when trying to register", err);
      this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
    }.bind(this)

    lxhr.send(JSON.stringify({
      username,
      password
    }));
  }

  startWS() {
    this.ws = new WebSocket("ws//" + this.state.host + "/game");

    this.client.onopen = function onWSOpen() {
      console.log("WS connection opened.");
    }

    this.ws.onmessage = function onWSMessage(message) {
      var data = message.data;

      if (!tryJSON(data)) {
        return console.warn("WS server sent non-JSON message.", message);
      }

      var o = JSON.parse(data);
      console.log("WS message", o);

      if (!o.type) {
        return console.warn("WS server send no type in message.", o);
      }

      if (o.type === "hello") {
        this.ws.send(JSON.stringify({
          type: "acct.auth",
          token: this.auth
        }));
      } else if (o.type === "acct.data") {
        if (!o.data) return console.warn("WS server sent no data in acct.data message.", o);
        this.state.accountData = o.data;

        if (!this.state.connected) {
          this.state.connected = true;
          this.onLoggedIn();
        }
      }
    }.bind(this);

    this.ws.onclose = function onWSClose(code, reason) {
      console.log("WS closed connection.",code, reason);
      return this.onerror("The server closed our connection.\nPlease refresh the page to reconnect.");
    }

    this.ws.onerror = function onWSError(e) {
      console.error("WS error", e);
      return this.onError("An error occurred while trying to connect to the server.\nAre you sure your host is a Signal server, and is up to date?");
    }
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.sint = new ServerInterface();
  }

  componentDidMount() {
    this.sint.onReadyForAuth = () => {
      // route to auth page
      console.log("ready for auth");
    }
    this.sint.start();
    console.log("started sint")
  }

  render() {
    return (
      <div className="app">
        asd
      </div>
    );
  }
}

export default App;
