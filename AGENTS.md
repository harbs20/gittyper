Gittyper is a typing test designed to help users learn Git workflows in a fun and interactive way. The game presents users with various Git commands and scenarios, challenging them to type the correct commands quickly and accurately. By practicing with Gittyper, users can improve their typing speed while reinforcing their understanding of Git operations, making it an effective tool for both learning and skill development.

3 modes are available in Gittyper: Learn, Execute, and Workflow. Each mode offers different levels of difficulty, allowing users to progress at their own pace.

Learn mode should be used by beginners to familiarize themselves with basic Git commands and concepts. In this mode, users are provided with hints and explanations for each command, helping them understand the purpose and usage of Git operations. Using one linersk, it will teach all basic Git commands. It will use like an auto-complete tutorial, guiding users through the commands step by step.

An example of beginner mode would look like this:
```
# Initialize a new repository
git init
```
A user can type the command and receive feedback on their accuracy and speed. If they make a mistake, the game will provide hints to help them correct it.

An example of execute mode would look like this:
```
# initialize a new repository from the parent directory, with the name "my-repo"

mkdir my-repo
cd my-repo
git init my-repo
```

An example of workflow mode would include a whole dirty git worktree, requiring users to perform a series of commands to achieve a clean worktree. This mode simulates real-world scenarios where users must apply their knowledge of Git commands to resolve issues and manage their repositories effectively.

An example of workflow mode would look like this:
```
# Add the changes relating to documentation to the staging area, and commit them with the message "Update documentation to better reflect the new features"

```
Auto-complete will not be used on the workflow or execute modes, as these modes are designed to test the user's ability to recall and apply Git commands without assistance. Users will need to rely on their understanding of Git operations and their ability to think critically about the steps required to complete the tasks presented in these modes.

This should all be fake git work, and not be commiting anything, so a way to sandbox it is critical. The game should simulate a Git environment without making any actual changes to the user's system or repositories. This can be achieved by creating a virtual file system or using a temporary directory to perform the Git operations, ensuring that users can practice and learn without any risk of data loss or corruption.

Also, in terms of the modes, the game should provide a clear progression path for users, allowing them to start with the Learn mode and gradually move on to Execute and Workflow modes as they gain confidence and proficiency in using Git. Each mode should have its own set of challenges and objectives, encouraging users to practice and improve their skills in a structured manner. It should also not use the same task every single time, but rather randomize the tasks to keep the user engaged and challenged. Making a long list of possible tasks for each mode will help ensure that users encounter a variety of scenarios, preventing the game from becoming repetitive and allowing them to develop a well-rounded understanding of Git operations.

Some GH commands may be used too, especially in workflow mode, to simulate real-world scenarios where users may need to interact with remote repositories. This could include commands for cloning repositories, pushing and pulling changes, and managing branches on GitHub. By incorporating these commands into the game, users can gain experience with both local and remote Git operations, further enhancing their skills and understanding of Git workflows.
