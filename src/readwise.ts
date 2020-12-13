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
    this.token = token;
    this.lastUpdate = lastUpdate;
  }

  fetchBooks(): Promise<[Book]> {
    console.log("Fetching books…");
    const params = { page_size: "1000", category: "books", last_highlighted_at__gt: this.lastUpdate, };

    return this.apiRequest<[Book]>('/books', params);
  }

  fetchHighlights(): Promise<[Highlight]> {
    console.log("Fetching highlights…");
    const params = { page_size: "1000", highlighted_at__gt: this.lastUpdate };

    return this.apiRequest<[Highlight]>('/highlights', params);
  }

  async apiRequest<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL("https://cors-anywhere.herokuapp.com/" + this.baseUrl + path);
    url.search = new URLSearchParams(params).toString();

    const request = new Request(url.toString(), {
      headers: {
        'Authorization': `Token ${this.token}`
      },
    });

    const response = await fetch(request).then(response => {
      if(!response.ok) {
        throw new Error(response.statusText);
      }
      return response;
    });
    const json = await (response.json() as Promise<{ results: T }>);

    return json.results;
  }
}
