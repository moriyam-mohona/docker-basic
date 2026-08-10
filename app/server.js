const express = require("express");
const os = require("os");

const app = express();

const PORT = process.env.PORT || 5000;

const INSTANCE = process.env.INSTANCE_NAME || os.hostname;

app.get("/", (req, res) => {
    res.send(`Hello World, I am from ${INSTANCE}`);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} from ${INSTANCE}`);
});