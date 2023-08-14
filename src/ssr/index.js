


const handleSSR = (req, res) => {

    //type html
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Book of Mormon Online</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Book of Mormon Online">
    </head>
    <body>
        <h1>Book of Mormon Online</h1>
        <p>Book of Mormon Online Server Side Rendered</p>
    </body>
    </html>`);
}


module.exports = {handleSSR}