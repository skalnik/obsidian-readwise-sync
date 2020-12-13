"use strict";
import { Plugin } from 'obsidian';
import ReadwiseClient from './src/readwise';
import { ReadwiseSettings, ReadwiseSettingsTab } from './src/settings';
import * as fs from 'fs';
import * as path from 'path';

const cacheFilename = ".cache.json";
const inboxDir = "Inbox";
const resourceDir = "Resources";
const forbiddenCharRegex = /\*|"|\\|\/|<|>|:|\||\?/g;
let books: { [id: number]: { title: string, normalizedTitle: string } } = {};
let lastUpdate = "";

export default class ObsidianReadwise extends Plugin {
  client: ReadwiseClient;
  settings: ReadwiseSettings;

  async onload(): Promise<void> {
    this.settings = (await this.loadData()) || new ReadwiseSettings();
    this.addSettingTab(new ReadwiseSettingsTab(this.app, this));
    this.addRibbonIcon('dice', 'Readwise', () => {
      this.readCache();
    });
  }

  readCache(): void {
    if (fs.existsSync(cacheFilename)) {
      fs.readFile(cacheFilename, 'utf8', (err: Error, data: string) => {
        if (err) throw err;

        const cache = JSON.parse(data);

        books = cache.books;
        lastUpdate = cache.lastUpdate;

        this.fetchBooks();
      });
    } else {
      lastUpdate = new Date(new Date().getTime() - 100 * 60 * 60 * 24 * 365).toISOString();
      this.client = new ReadwiseClient(this.settings.token, lastUpdate);
      this.fetchBooks();
    }
  }

  fetchBooks(): void {
    console.log("Fetching books…");

    this.client.fetchBooks().then((apiBooks) => {
      for (const book of apiBooks) {
        const normalizedTitle = book.title.replace(forbiddenCharRegex, "-");
        books[book.id] = {
          title: book.title,
          normalizedTitle: normalizedTitle
        };

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

  fetchHighlights(): void {
    console.log("Fetching highlights…");

    this.client.fetchHighlights().then((highlights) => {
      for (const highlight of highlights) {
        const filename = path.join(inboxDir, `${highlight.id}.md`);

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

  writeCache(): void {
    const cache = {
      books: books,
      lastUpdate: (new Date()).toISOString()
    };

    fs.writeFile(cacheFilename, JSON.stringify(cache), (err: Error) => {
      if (err) throw err;
      console.log("Cache updated!");
    });
  }
}
