## Users Schema
```json
{
    "_id": ObjectId,
    "username": String,
    "password": String,
    "pass_salt": String,
    "avatar": "base64string",
    "email": {id:"validated_verified_email",verified:Boolean},
    "about": "max_120_char_string",
    "public_key": String,
    "chatIds": String[],
    "createdAt": Date,
    "banned": Boolean
}
```
## Messages Schema
```json
{
    "_id": ObjectId,
    "content": String,
    "createdAt": String,
    "edited": Boolean,
    "chatId": String
}
```
## Chats Schema
```json
{
    "_id": ObjectId,
    "name": String,
    "createdAt": String,
    "createdBy": String,
    "messageIds": String[],
    "avatar": "base64string",
    "memberIds": String[]
}