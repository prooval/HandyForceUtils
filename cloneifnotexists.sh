# Variables
REPO_URL="https://github.com/yourusername/yourrepository.git"
CLONE_DIR="./yourrepository"

# Function to clone if not exists
clone_if_not_exists() {
    if [ ! -d "$CLONE_DIR" ]; then
        echo "Directory $CLONE_DIR does not exist. Cloning now..."
        git clone $REPO_URL $CLONE_DIR
        if [ $? -ne 0 ]; then
            echo "Git clone failed!"
            exit 1
        fi
    else
        echo "Directory $CLONE_DIR exists. Skipping clone."
    fi
}

# Call function
clone_if_not_exists
