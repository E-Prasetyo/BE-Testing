const fs = require('fs');
const path = require('path')

const removeFile = (filePath) => {
    const fileUrl =  path.join(__dirname, '..', filePath)
    fs.unlink(fileUrl, (err) => {
        if (err) {
            throw (err);
        }
    });
}

exports.removeFile = removeFile;