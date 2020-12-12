export type Book = {
  id: number;
  title: string;
  author: string;
}

export type Highlight = {
  id: number;
  book_id: number;
  text: string;
  note: string;
}

export default class ReadwiseClient {
  baseUrl = "https://readwise.io/api/v2"
  token: string;
  lastUpdate: string;

  constructor(token: string, lastUpdate = "") {
    this.token = token
    this.lastUpdate = lastUpdate
  }

  fetchBooks(): Promise<[Book]> {
    console.log("Fetching books…");
    const params = { page_size: "1000", category: "books", last_highlighted_at__gt: "2019-12-01T21:35:53Z", }

    return this.apiRequest<[Book]>('/books', params)
  }

  fetchHighlights(): Promise<[Highlight]> {
    console.log("Fetching highlights…");
    const params = { highlighted_at__gt: "2020-01-01T21:35:53Z" };

    return this.apiRequest<[Highlight]>('/highlights', params);
  }

  apiRequest<T>(path: string, params: {}): Promise<T> {
    const request = new Request(this.baseUrl + path, {
      headers: {
        Authorization: `token ${this.token}`
      },
      body: new URLSearchParams(params)
    });

    return fetch(request).then(response => {
      if(!response.ok) {
        throw new Error(response.statusText)
      }

      return response.json() as Promise<{ data: { results: T } }>
    }).then(response => {
      return response.data.results
    })
  }
}
