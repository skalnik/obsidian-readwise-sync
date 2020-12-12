"use strict";
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

const axios = require("axios").default;
const fs = require("fs");
const path = require("path");

const cacheFilename = ".cache.json"
const token = "";
const inboxDir = "Inbox";
const resourceDir = "Resources";
const forbiddenCharRegex = /\*|"|\\|\/|<|>|:|\||\?/g
let books: { [id: number]: { title: string, normalizedTitle: string } } = {};
let lastUpdate = "";

export default class ObsidianReadwise extends Plugin {
  onload() {
    this.readCache();
  }

  readCache() {
    if (fs.existsSync(cacheFilename)) {
      fs.readFile(cacheFilename, (err: Error, data: string) => {
        if (err) throw err;

        const cache = JSON.parse(data)

        books = cache.books;
        lastUpdate = cache.lastUpdate;

        this.fetchBooks()
      })
    } else {
      lastUpdate = new Date(new Date().getTime() - 100 * 60 * 60 * 24 * 365).toISOString()
      this.fetchBooks()
    }
  }

  fetchBooks() {
    console.log("Fetching books…");
    const options = {
      url: "https://readwise.io/api/v2/books",
      headers: {
        Authorization: `token ${token}`,
      },
      params: {
        page_size: "1000",
        category: "books",
        last_highlighted_at__gt: "2019-12-01T21:35:53Z",
      },
    };

    axios.request(options).then((res: { data: { results: [ { id: number, title: string, author: string } ] } } ) => {
      for (const book of res.data.results) {
        let normalizedTitle = book.title.replace(forbiddenCharRegex, "-")
        books[book.id] = {
          title: book.title,
          normalizedTitle: normalizedTitle
        }

        const filename = path.join(resourceDir, `${normalizedTitle}.md`);
        const body = `---
          tags: book
          ---

          **Title**: ${book.title}
          **Author**: [[${book.author}]]
          **Read**: [[{{date}}]]
          })
          `;

        if (!fs.existsSync(filename)) {
          fs.writeFile(filename, body, (err: Error) => {
            if (err) throw err;

            console.log(`${normalizedTitle}.md created!`);
          });
        }
      }
      console.log("All books created!");
      this.fetchHighlights();
    });
  }

  fetchHighlights() {
    console.log("Fetching highlights…");
    const options = {
      url: "https://readwise.io/api/v2/highlights",
      headers: {
        Authorization: `token ${token}`,
      },
      params: {
        highlighted_at__gt: "2020-01-01T21:35:53Z",
      },
    };

    axios.request(options).then((res: { data: { results: [ {id: number, book_id: number, text: string, note: string }]} }) => {
      for (const highlight of res.data.results) {
        const filename = path.join(inboxDir, `${highlight.id}.md`)

        let body = `> ${highlight.text}
— [[${books[highlight.book_id].normalizedTitle}]]`;

        if (highlight.note.length > 0) {
          body += `\n\n${highlight.note}`;
        }

        if (!fs.existsSync(filename)) {
          fs.writeFile(filename, body, (err: Error) => {
            if (err) throw err;

            console.log(`${highlight.id}.md created!`);
          });
        }
      }
      console.log("All highlights created!");
      this.writeCache();
    });
  }

  writeCache() {
    const cache = {
      books: books,
      lastUpdate: (new Date()).toISOString()
    };

    fs.writeFile(cacheFilename, JSON.stringify(cache), (err: Error) => {
      if (err) throw err;
      console.log("Cache updated!")
    });
  }
}
