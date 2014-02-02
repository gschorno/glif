# finalize files properties for the project

# set file and directory permissions 

find .. -type f -exec chmod 644 {} \;

find .. -type d -exec chmod 755 {} \;