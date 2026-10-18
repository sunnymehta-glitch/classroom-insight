@echo off
setlocal EnableDelayedExpansion

REM ============================================================================
REM Classroom Insight Maven Wrapper (Windows)
REM Automatically detects Java 25 LTS and Maven, respecting existing environment variables.
REM ============================================================================

REM 1. Respect existing JAVA_HOME if set
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\javac.exe" (
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        goto :find_maven
    )
)

REM 2. Check if default java in PATH is Java 25
for /f "tokens=3" %%v in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set "RAW_VER=%%~v"
    set "RAW_VER=!RAW_VER:"=!"
    if "!RAW_VER:~0,2!"=="25" (
        goto :find_maven
    )
)

REM 3. Search standard Java 25 installation locations
for /d %%j in ("C:\Program Files\Java\jdk-25*" "C:\Program Files\Eclipse Adoptium\jdk-25*" "C:\Program Files\Microsoft\jdk-25*" "C:\Program Files\JetBrains\IntelliJ IDEA*") do (
    if exist "%%j\bin\javac.exe" (
        set "JAVA_HOME=%%j"
        goto :found_java
    )
    if exist "%%j\jbr\bin\javac.exe" (
        set "JAVA_HOME=%%j\jbr"
        goto :found_java
    )
)

:found_java
if defined JAVA_HOME (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
) else (
    echo [ERROR] Java 25 LTS was not found.
    echo Please install Java 25 LTS and set JAVA_HOME before running this wrapper.
    exit /b 1
)

:find_maven
REM Check PATH for mvn
where mvn >nul 2>&1
if %ERRORLEVEL% equ 0 (
    mvn %*
    goto :end
)

if defined MAVEN_HOME (
    if exist "%MAVEN_HOME%\bin\mvn.cmd" (
        call "%MAVEN_HOME%\bin\mvn.cmd" %*
        goto :end
    )
)

for /d %%m in ("C:\Program Files\apache-maven*" "C:\Program Files\JetBrains\IntelliJ IDEA*") do (
    if exist "%%m\bin\mvn.cmd" (
        call "%%m\bin\mvn.cmd" %*
        goto :end
    )
    if exist "%%m\plugins\maven-plugin\lib\maven3\bin\mvn.cmd" (
        call "%%m\plugins\maven-plugin\lib\maven3\bin\mvn.cmd" %*
        goto :end
    )
)

echo [ERROR] Apache Maven was not found on PATH or in standard installation directories.
echo Please install Maven 3.9+ or set MAVEN_HOME.
exit /b 1

:end
exit /b %ERRORLEVEL%
