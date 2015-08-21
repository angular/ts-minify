
function getFileAndName(): { fileName: string, qname: string } {
    var fileName = 'hello';
    var blah = 'world';
    return { fileName, qname: blah };
}

var obj = getFileAndName();
obj.fileName;
obj.qname;