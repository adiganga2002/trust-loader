import "./../loader-config.js";
import {Spinner, prepareView, createFormElement, toggleViewPassword, prepareViewContent} from "./services/UIService.js";
import WalletService from "./services/WalletService.js";
import NavigatorUtils from "./services/NavigatorUtils.js";


function NewController() {

  const USER_DETAILS_FILE = "user-details.json";
  let wizard;
  let spinner;
  let formFields = [];
  const walletService = new WalletService();
  let self = this;

  if (LOADER_GLOBALS.environment.mode === "dev-secure") {
    if (!LOADER_GLOBALS.credentials.isValid) {
      LOADER_GLOBALS.credentials.isValid = true;
      LOADER_GLOBALS.credentials.username = "devsuperuser"
      LOADER_GLOBALS.credentials.email = "dev@superuser.dev";
      LOADER_GLOBALS.credentials.company = "Company Inc";
      LOADER_GLOBALS.credentials.password = "SuperUserSecurePassword1!";
      LOADER_GLOBALS.credentials['confirm-password'] = "SuperUserSecurePassword1!";
      LOADER_GLOBALS.saveCredentials();
      console.log("Initialising credentials for develoment mode");
    }
  }

  this.printCode = function () {
    window.print();
  }

  this.copyCode = function copy() {
    let range = document.createRange();
    range.selectNode(document.getElementById("recovery-code"));
    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("copy");
  }

  this.pinCheckboxHandler = function (event) {
    document.getElementById("pin-input-container").classList.toggle("d-none");
    document.getElementById('pincode-help').innerHTML = LOADER_GLOBALS.LABELS_DICTIONARY.PINCODE_HELP;
  }

  this.writeUserDetailsToFile = function (wallet, callback) {
    wallet.writeFile(USER_DETAILS_FILE, JSON.stringify(LOADER_GLOBALS.credentials), callback);
  }

  this.getUserDetailsFromFile = function (wallet, callback) {
    wallet.readFile(USER_DETAILS_FILE, (err, data) => {
      if (err) {
        return callback(err);
      }
      const dataSerialization = data.toString();
      callback(undefined, JSON.parse(dataSerialization))
    });
  }
  this.hasInstallationUrl = function () {
    let windowUrl = new URL(window.location.href);
    return windowUrl.searchParams.get("appName") !== null;
  };

  this.init = function () {
    NavigatorUtils.hasRegisteredServiceWorkers((error, hasServiceWorker) => {
      if (hasServiceWorker) {
        NavigatorUtils.unregisterAllServiceWorkers(() => {
          window.location.reload();
        });
      } else {
        spinner = new Spinner(document.getElementsByTagName("body")[0]);
        wizard = new Stepper(document.getElementById("psk-wizard"));
      }
    });
  };

  //TODO Refactore and restructure the whole bs...
  function getWalletSecretArrayKey(usePin) {
    let arr = Object.values(LOADER_GLOBALS.credentials).filter(elem => typeof elem !== "boolean");
    return arr;
  }

  function createWallet() {

    spinner.attachToView();
    try {
      console.log("Creating wallet...");
      LOADER_GLOBALS.saveCredentials();

      walletService.create(LOADER_GLOBALS.environment.domain, getWalletSecretArrayKey(), (err, wallet) => {
        if (err) {
          document.getElementById("register-details-error").innerText = "An error occurred. Please try again.";
          return console.error(err);
        }
        let writableWallet = wallet;

        writableWallet.getKeySSIAsString((err, keySSI) => {
          console.log(`Wallet created. Seed: ${keySSI}`);

          self.writeUserDetailsToFile(writableWallet, (err, data) => {
            if (err) {
              return console.log(err);
            }

            self.getUserDetailsFromFile(writableWallet, (err, data) => {
              if (err) {
                return console.log(err);
              }
              console.log("Logged user", data);
            })

          });

          document.getElementById("recovery-code").innerHTML = keySSI;
          spinner.removeFromView();
          wizard.next();
        });
      });
    } catch (e) {
      document.getElementById("register-details-error").innerText = "Seed is not valid.";
    }
  }

  this.previous = function (event) {
    event.preventDefault();
    //document.getElementById("seed").value = "";
    document.getElementById("restore-seed-btn").setAttribute("disabled", "disabled");
    wizard.previous();
  };

  this.submitPassword = function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.formIsValid()) {
      LOADER_GLOBALS.clearCredentials();
      formFields.forEach(field => {
        if (field !== "confirm-password") {
          LOADER_GLOBALS.credentials[field] = document.getElementById(field).value;
        }
      })
      createWallet();
    }
  };

  this.submitAfterRegistration = function (event) {
    if (document.getElementById("pin-checkbox").checked && document.getElementById("pincode").getAttribute('valid')) {
      LOADER_GLOBALS.savePinCodeCredentials(document.getElementById("pincode").value, LOADER_GLOBALS.credentials);
      console.log('decrypt ', LOADER_GLOBALS.loadPinCodeCredentials(document.getElementById("pincode").value))
    }

    walletService.load(LOADER_GLOBALS.environment.domain, getWalletSecretArrayKey(), (err, wallet) => {
      if (err) {
        spinner.removeFromView();
        console.error("Failed to load the wallet in domain:", LOADER_GLOBALS.environment.domain, getWalletSecretArrayKey(), err);
        return (document.getElementById("register-details-error").innerText = "Invalid credentials");
      }

      wallet.getKeySSIAsString((err, keySSI) => {
        if (err) {
          console.error(err);
          return console.error("Operation failed. Try again");
        }

        console.log(`Loading wallet ${keySSI}`);
        spinner.removeFromView();
        const basePath = window.location.href.split("loader")[0];
        window.location.replace(basePath + "loader/?login=auto");
      });
    });
  }

  this.goToLandingPage = function () {
    window.location.replace("./");
  };

  this.formIsValid = function () {
   return validator.validateForm(formFields);
  }

  this.createForm = function () {
    let formElement = document.getElementsByClassName("form-content-container")[0];
    LOADER_GLOBALS.REGISTRATION_FIELDS.slice().reverse().forEach(field => {
      if (field.visible) {
        formFields.push(field.fieldId);
        formElement.prepend(createFormElement(field, {inputType: "helperInput"}));
      }
    })
  }
}

let controller = new NewController();

document.addEventListener("DOMContentLoaded", function () {
  let LABELS = LOADER_GLOBALS.LABELS_DICTIONARY;
  const page_labels = [
    {title: LABELS.APP_NAME},
    {"#step-register-details": LABELS.REGISTER_DETAILS},
    {"#step-complete": LABELS.COMPLETE},
    {"#back-btn": LABELS.BACK_BUTTON_MESSAGE},
    {"#register-btn": LABELS.REGISTER_BUTTON_MESSAGE},
    {"#register-successfully": LABELS.REGISTER_SUCCESSFULLY},
    {"#seed_print": LABELS.SEED_PRINT},
    {"#open-wallet-btn": LABELS.OPEN_WALLET}

  ];
  if (controller.hasInstallationUrl()) {
    page_labels.push({"#more-information": LOADER_GLOBALS.NEW_WALLET_MORE_INFORMATION});
  } else {
    document.querySelector("#more-information").remove();
  }

  controller.createForm();
  prepareView(page_labels);
  prepareViewContent();
  /*//add ckick listener to toggle password view
  let passToggles = document.getElementsByClassName("toggle-password");
  for (let i = 0; i < passToggles.length; i++) {
    passToggles[i].addEventListener("click", (event) => {
      toggleViewPassword(event);
    })
  }*/


  if (LOADER_GLOBALS.environment.allowPinLogin) {
    document.getElementById("pin-container").classList.remove("d-none");
  }

  controller.init();

//populate fields with existing values
  LOADER_GLOBALS.REGISTRATION_FIELDS.forEach(item => {
    if (document.getElementById(item.fieldId)) {
      let htmlElem = document.getElementById(item.fieldId);
      htmlElem.value = LOADER_GLOBALS.credentials[item.fieldId] || "";
    }
  });

})
;
window.controller = controller;
