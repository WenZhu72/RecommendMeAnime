import requests

ANILIST_URL = "https://graphql.anilist.co"

def search_anilist_media(query: str, media_type: str):
    graphql_query = """
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: $type) {
          id
          title {
            romaji
            english
          }
          description(asHtml: false)
          averageScore
          genres
          episodes
          chapters
          coverImage {
            large
          }
        }
      }
    }
    """

    variables = {
        "search": query,
        "type": media_type
    }

    response = requests.post(
        ANILIST_URL,
        json={"query": graphql_query, "variables": variables}
    )

    response.raise_for_status()

    data = response.json()
    media = data["data"]["Page"]["media"]

    results = []

    for item in media:
        results.append({
            "id": item["id"],
            "title": item["title"]["english"] or item["title"]["romaji"],
            "romajiTitle": item["title"]["romaji"],
            "description": item["description"],
            "coverImage": item["coverImage"]["large"],
            "averageScore": item["averageScore"],
            "genres": item["genres"],
            "episodes": item["episodes"],
            "chapters": item["chapters"],
        })

    return results