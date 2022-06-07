# Sync from github
git pull origin
git checkout master

# Remove temp remote in case it wasn't removed previously
git remote remove heroku_temp

# Create temp remote and add multiple remote repos
git remote add heroku_temp https://git.heroku.com/se-electionbot.git
git remote set-url --add --push heroku_temp https://git.heroku.com/se-electionbot.git
git remote set-url --add --push heroku_temp https://git.heroku.com/se-electionbot2.git
git remote set-url --add --push heroku_temp https://git.heroku.com/se-electionbot3.git
git remote set-url --add --push heroku_temp https://git.heroku.com/se-electionbot4.git
git remote set-url --add --push heroku_temp https://git.heroku.com/se-electionbot5.git

# Push to all remote repos
git push -f heroku_temp master

# Remove temp remote when complete
git remote remove heroku_temp

# Wait for user input before terminating
echo Done. Press enter to continue...
read