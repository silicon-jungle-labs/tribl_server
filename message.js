class Message {
  constructor({ text, from , to }) {
    this._text = text;
    this._from = from;
    this._to = to;
    this.timestamp = Date.now();
  }

  getText() {
    return this._text;
  }
}

module.exports = Message;
