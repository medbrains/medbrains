require("@medbrains/mobile-shell/runtime-polyfills");

const { registerRootComponent } = require("expo");
const App = require("./App").default;

registerRootComponent(App);
