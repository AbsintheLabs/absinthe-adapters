How to turn json into the config string easily:

```bash
echo "\nINDEXER_CONFIG='$(jq -c . src/config/ichiconfig.json)'" >> .env
```
