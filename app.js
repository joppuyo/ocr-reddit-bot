const isPorn = require("./pornDetection").isPorn;
const extractText = require("./extractText");
const resizeImage = require("./resizeImage");
const greyscaleImage = require("./greyscaleImage");
const axios = require("axios");
const fs = require('fs');
const RedditApi = require("snoowrap");
const oauth_info = require("./oauth_info.json");
const settings = require("./settings.json");

const download_image = (url, image_path) =>
  axios({
    url,
    responseType: 'stream',
  }).then(
    response =>
      new Promise((resolve, reject) => {
        response.data
          .pipe(fs.createWriteStream(image_path))
          .on('finish', () => resolve())
          .on('error', e => reject(e));
      }),
  );

const reddit = new RedditApi(oauth_info);

async function assessPorn() {
    // moved sub to the settings.json file
    let sub = settings.subreddit;
    console.log("Assessing...");
    var posts = await reddit.getSubreddit(sub)
        .getModqueue();
        // .getSpam();
    
    console.log("Found " + posts.length + " items in queue");
    
    await asyncForEach(posts, async (submission) => {
        var username = submission.author.name;
        var url = submission.url;
        var id = submission.id;
        
        if (url) {
            console.log(id + " is an image");
            var lastDot = url.lastIndexOf(".");
            var extension = url.substr(lastDot, url.length - lastDot);
            var imageFile =  "./possiblePorn/" + id + extension;
            await download_image(url, imageFile);

            try {
                var isporn = await run(imageFile);

                if (isporn) {
                    console.log(id + " is porn - removing and banning");
                    await submission.remove();
                    await reddit.getSubreddit(sub).banUser({name: username, banReason: 'No NSFW content', banNote: "porn" });
                } else {
                    console.log(id + " is probably not porn");
                }
            } catch {
                console.log(id + " something went wrong when processing this ID");
            }

            await fs.unlinkSync(imageFile);
        } else {
            console.log(id + " is not an image");
        }
        
    });

    setTimeout(assessPorn, 30000);
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

async function run(file) {
    let lastDot = file.lastIndexOf(".");
    let newFile = file.substr(0, lastDot) + "-resized" + file.substr(lastDot, file.length - lastDot);
    let newFile2 = file.substr(0, lastDot) + "-greyscaled" + file.substr(lastDot, file.length - lastDot);

    await resizeImage(file, newFile);
    await greyscaleImage(newFile, newFile2);

    extracted = await extractText(newFile2);
    porn = isPorn(extracted);

    await fs.unlinkSync(newFile);
    await fs.unlinkSync(newFile2);

    return porn;
}

module.exports = {
    assessAndReportPorn: assessPorn,
    assessPorn: run
};

