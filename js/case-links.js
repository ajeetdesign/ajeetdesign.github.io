/* Where each case study currently lives — declared here and nowhere else.

   A key in this table means the write-up is still hosted outside this site:
     · index.html points that project's card straight at the URL, opens it in a
       new tab, and swaps the arrow for the leaves-the-site glyph
     · case.html redirects anyone who reaches its internal URL to the same place
   so a project has exactly one destination however a reader arrives at it.

   No key means the study is internal: it renders from cases.enc.json in the
   overlay, the way Porter does. Bringing one in-house is therefore a one-line
   change — delete its line here, and both pages re-wire themselves. Nothing
   else in either file names these URLs, so there is no second copy to drift.

   Loaded as a plain script before the wiring in both pages, so it has to stay
   an ordinary global rather than a module export.

   Keys must match the data-case attribute on the card in index.html and the
   ?id= parameter case.html reads:
     porter               — internal, renders from cases.enc.json
     porter-uae-earnings  — external, password-gated Link Lock page
     porter-uae-cash      — external, password-gated Link Lock page
     juspay               — external, password-gated Link Lock page

   All four project cards now resolve here or internally — no fallback
   warnings pending. */
window.CASE_LINKS = {
  'porter-uae-earnings': 'https://jstrieb.github.io/link-lock/#eyJ2IjoiMC4wLjEiLCJlIjoiZFl1MzhINjFMcDhWMjg5dXFOTVExVVpJOFZKR3ZVRFRwSlY4WjlCM3NGREZtWUZBejJvZlo3T3cxalduSzQzSkdtbGl2MWtMeHlEVHdML2dLS3ZOMDlLT085ZWFjcjk2ZlA1b1dFZUlMKzFuc1d2dDRVOWxDQXV2UnVCRktodkwzWHhxWlpTMTlEZGhTcXJ0UkNVRXplL3RiQjZWRlIxUHY5TXBUdU5LMXBZbGFQQTdTd2l6R0orN1N3cCtDdG5VK21kc1psUGQ1U0FJZldxOURUMWpyVk1INEdLT3oxUkMwQjF3MDc3TGd0WWRhcEVWYVl6ZThOaGp4QnRlVkR5OGUzYlZEdDZZdVMzQ2JhYldUSm80N3RtOTd6SWlIeldLVUFMMXdhTy8iLCJzIjoiK0k3ZG1HZjN1YVQ5RUt4L2tON1hLQT09IiwiaSI6Iit0QUZ1ZFNZeTRjaFhIZFEifQ==',
  'porter-uae-cash': 'https://jstrieb.github.io/link-lock/#eyJ2IjoiMC4wLjEiLCJlIjoiaXF0SStlLzBOUzE2OHUvSmxkRDR5b3RMTkcyWEh1Ulc5cDc2aXZXV1dXbEU1Vko3Qk1YRDNld1RnUWxDT044WkdlWFpzZXd5dzV5MG5aVU5nU1Vlcm5wZUdsdzBGdDBSWHBERy8zTlhlR2FHajlzZXBGWmZ3VTYzM1lVVEN4UXQ2Wk9IYVQ1UTAyTUFuTzFkRFRESTZiT3JZV0FkcEJzQmRYNmM5OFY4UlJpTVJCdCtJZDNRVjhIT1lHblhtbjdVeGNPWHlTZDNHYjRaMmJ1dzMwMGJaTzc2ck82cVY0N1NFZUt3cXNvRXpJWndmSDlmUzNpK2Mya3lJMSsvT3ZibnY3Y1NTN2oxb1pUOG9WQjV0SkpZc2ZoUzVEanFaTjM1IiwicyI6IkFGL0hYL20wZWlweFpqa3dtVVF3eUE9PSIsImkiOiI0VEozNW1JVm1zTjVKZll0In0=',
  juspay: 'https://jstrieb.github.io/link-lock/#eyJ2IjoiMC4wLjEiLCJlIjoiN285UzNzQWx5OUNBZ055UTcwaXRVWVZoTkJDTFpaTmZ3L1hGblBnOTl5Z0paenp5QlBqcklUU0tiK1k0ZmR3TkFZaFVOYTZKRXFwdUYwZW5LSzJ1OEs2YVlUakJFQVBlSEtmRGxMcWpUcnZQWWcyakJqMmpqSWFCdlRZQ2JaWDFsaWtPVm5tRUViSmEzeWp0Yzk5VExtaHpZYVR1MVpUeFRLVVBpZTl2MWdFQlYwN1ZNcUhHNk5jczk4MlhXQnVIVFJRNWVjL0RNN2hqWTFxNzlnVXRTMlRucTA1ZWhDRlJKaXNpam0vZGtrVjJUZmdYNjJ1Z3F0d2xlSzYvTWtiWUp2T01KT2dWYUZtWWdsQ0M5VkJENlhoVTdGUT0iLCJzIjoiR3RkRXR0bWY4NXhVQ0pVYVlOWXhvZz09IiwiaSI6IkJqN1pPOTBHeXNtR09pY3kifQ==',
};
