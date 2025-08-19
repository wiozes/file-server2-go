package main

import (
	"encoding/json"
	"flag"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type FileInfo struct {
	ID        int    `json:"id"`
	FileName  string `json:"file_name"`
	Size      int64  `json:"size"`
	IsDir     bool   `json:"is_dir"`
	MimeType  string `json:"mime_type"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func filesHandler(rootDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Configurar headers para CORS (si es necesario)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Connection", "keep-alive")

		dirPath := rootDir
		if dirQuery := r.URL.Query().Get("dir"); dirQuery != "" {
			dirPath = filepath.Join(rootDir, dirQuery)
		}

		// Verificar si el directorio existe
		if _, err := os.Stat(dirPath); os.IsNotExist(err) {
			http.Error(w, `{"error": "Directory not found"}`, http.StatusNotFound)
			return
		}

		// Obtener lista de archivos
		files, err := os.ReadDir(dirPath)
		if err != nil {
			http.Error(w, `{"error": "Error reading directory"}`, http.StatusInternalServerError)
			return
		}

		var fileList []FileInfo
		var id int

		for _, file := range files {
			id++
			filePath := filepath.Join(dirPath, file.Name())

			fileInfo, err := os.Stat(filePath)
			if err != nil {
				log.Printf("Error getting file info for %s: %v", filePath, err)
				continue
			}
			// Determinar el tipo MIME
			var mimeType string

			if !fileInfo.IsDir() {
				fileHandle, err := os.Open(filePath)
				if err != nil {
					log.Printf("Error opening file %s: %v", filePath, err)
					continue
				}
				defer fileHandle.Close() // Usar defer para asegurar el cierre

				buffer := make([]byte, 512)
				n, err := fileHandle.Read(buffer)
				if err != nil && err != io.EOF {
					log.Printf("Error reading file %s: %v", filePath, err)
					continue
				}

				// Solo usar los bytes realmente leídos
				if n > 0 || n == 0 {
					extension := strings.ToLower(filepath.Ext(filePath))

					switch extension {
					case ".jpg", ".jpeg":
						mimeType = "image/jpeg"
					case ".png":
						mimeType = "image/png"
					case ".gif":
						mimeType = "image/gif"
					case ".mp4":
						mimeType = "video/mp4"
					case ".mp3":
						mimeType = "audio/mpeg"
					case ".txt":
						mimeType = "text/plain"
					case ".pdf":
						mimeType = "application/pdf"
					case ".zip":
						mimeType = "application/zip"
					case ".tar":
						mimeType = "application/x-tar"
					case ".html", ".htm":
						mimeType = "text/html"
					case ".css":
						mimeType = "text/css"
					case ".js":
						mimeType = "application/javascript"
					case ".json":
						mimeType = "application/json"
					case ".xml":
						mimeType = "application/xml"

					case ".csv":
						mimeType = "text/csv"
					case ".doc", ".docx":
						mimeType = "application/msword"
					case ".xls", ".xlsx":
						mimeType = "application/vnd.ms-excel"
					case ".ppt", ".pptx":
						mimeType = "application/vnd.ms-powerpoint"
					case ".avi":
						mimeType = "video/x-msvideo"
					case ".mov":
						mimeType = "video/quicktime"
					case ".mkv":
						mimeType = "video/x-matroska"
					case ".flv":
						mimeType = "video/x-flv"
					case ".webm":
						mimeType = "video/webm"
					case ".wav":
						mimeType = "audio/wav"
					case ".ogg":
						mimeType = "audio/ogg"
					case ".bmp":
						mimeType = "image/bmp"
					case ".svg":
						mimeType = "image/svg+xml"
					case ".ico":
						mimeType = "image/x-icon"
					case ".exe":
						mimeType = "application/x-msdownload"
					case ".dll":
						mimeType = "application/x-msdownload"
					case ".sh":
						mimeType = "application/x-sh"

					default:
						mimeType = strings.ToUpper(extension)
					}

				}
			} else {
				mimeType = "directory"
			}
			fileList = append(fileList, FileInfo{
				ID:        id,
				FileName:  fileInfo.Name(),
				Size:      fileInfo.Size(),
				IsDir:     fileInfo.IsDir(),
				MimeType:  mimeType,
				CreatedAt: fileInfo.ModTime().Format(time.RFC3339),
				UpdatedAt: fileInfo.ModTime().Format(time.RFC3339),
			})
		}

		// Codificar respuesta JSON
		if err := json.NewEncoder(w).Encode(fileList); err != nil {
			log.Printf("Error encoding JSON: %v", err)
			http.Error(w, `{"error": "Error generating JSON response"}`, http.StatusInternalServerError)
		}
	}
}

func fileDownloadHandler(dirPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fileName := r.URL.Path[len("/files/"):]
		if fileName == "" {
			http.Error(w, "Filename required", http.StatusBadRequest)
			return
		}

		filePath := filepath.Join(dirPath, fileName)
		http.ServeFile(w, r, filePath)
	}
}

// Handler para devolver el current dirPath en JSON
func currentPathHandler(dirPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"dirPath": dirPath})
	}
}

func runFileServer(dirPath string, port string, host string) {

	http.HandleFunc("/api/files", filesHandler(dirPath))
	http.HandleFunc("/files/", fileDownloadHandler(dirPath))
	http.HandleFunc("/api/currentPath", currentPathHandler(dirPath))

	// Servir archivos estáticos del frontend en la raíz
	fs := http.FileServer(http.Dir("./frontend"))
	http.Handle("/", http.StripPrefix("/", fs))

	server := &http.Server{
		Addr:         host + ":" + port,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Servidor escuchando en http://%s:%s", host, port)
	// Iniciar el servidor

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Error al iniciar el servidor: %v", err)
	}
}

func main() {
	show_options := `Options: 
			-s <path>   Ruta del directorio a servir
			-host <host> Host del servidor (default: localhost)
			-server_port <port>   Puerto del servidor (default: 8080)
			-h 		  Muestra esta ayuda
		`
	dirPath := flag.String("s", "", "Ruta del directorio a servir")
	port := flag.String("server_port", "8080", "Puerto del servidor (default: 8080)")
	help_options := flag.Bool("h", false, show_options)
	host := flag.String("host", "localhost", "Host del servidor (default: localhost)")

	flag.Parse()
	if *help_options {
		log.Println(show_options)
		return
	}

	if *dirPath == "" {
		log.Fatal("Error: La ruta del directorio es requeridaa: go run main.go -s /ruta/a/tus/archivos")
	}

	runFileServer(*dirPath, *port, *host)

}
