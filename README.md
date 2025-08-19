I have created this file server written in Go, it is used to view images and download files, the main idea is to be able to access a directory and view its contents from another device, for example mobile.


I still need to implement major improvements (TODO):

- Settings panel
- Authentication login
- Download folders and compress them
- Permitt only connection from one ip


And example of use:

```
go run .\obito.go -s C:\Users\{%username%}\Documents

```

And there are different options:

-s <Route_to_path>
-host
-port





