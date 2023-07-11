function getOutpointFromId(id) {
  const outpoint = id.split("");
  outpoint[id.length - 2] = ":";
  return outpoint.join("");
}

exports.getOutpointFromId = getOutpointFromId;