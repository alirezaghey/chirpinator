import React, { useState, useCallback, useEffect, useRef } from 'react'

import './fonts/fonts.css'
import './icons/css/fontello.css'
import './App.scss'

const TIME_FORMAT = {
    HH_MM_SS: 'HH_MM_SS',
    MM_SS: 'MM_SS',
    H_MM: 'H_MM',
    SS: 'SS'
}

const PAGE = {
    CHIRPINATOR: 'CHIRPINATOR',
    EXPORT: 'EXPORT',
    SETTINGS: 'SETTINGS',
    CRITICAL_FAILURE: 'CRITICAL_FAILURE'
}

const EXPORT_FORMAT = {
    JSON: 'JSON',
    CSV: 'CSV'
}

const PAGE_WIDTH = {
    FULL: 'FULL',
    WIDE: '1000',
    MEDIUM: '700',
    SHORT: '400'
}

function formatNumberTime( timeInSeconds = 0, timeFormat = TIME_FORMAT.HH_MM_SS ) {
    if ( timeFormat === TIME_FORMAT.SS ) {
        return `${timeInSeconds} sec.`
    }

    const hours   = Math.floor( timeInSeconds / 3600 )
    const minutes = Math.floor( ( timeInSeconds / 60 ) % 60 )
    const seconds = Math.floor( timeInSeconds % 60 )

    switch ( timeFormat ) {
        case TIME_FORMAT.H_MM: {
            const hourFraction = ( minutes + ( seconds / 60 ) ) / 60
            return `${( hours + hourFraction ).toFixed( 2 )} hrs.`
        }
        case TIME_FORMAT.MM_SS: {
            const paddedSeconds = seconds.toString().padStart( 2, '0' )
            return `${hours * 60 + minutes}:${paddedSeconds}`
        }
        case TIME_FORMAT.HH_MM_SS:
        default: {
            const paddedHours   = hours.toString().padStart( 2, '0' )
            const paddedMinutes = minutes.toString().padStart( 2, '0' )
            const paddedSeconds = seconds.toString().padStart( 2, '0' )
            return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`
        }
    }
}

const Timer = ( {
    className = '',
    timeString,
    canPlay,
    canRemove,
    big,
    active,
    onPlay,
    onPause,
    onRemove
} ) => (
    <div className={ `timer ${className} ${active ? 'timer_active' : ''} ${big ? 'timer_big' : ''}`.trim() }>
        <div className="timer__time">{ timeString }</div>
    { canRemove &&
        <button
            className="timer__control-button"
            title="Remove task"
            onClick={ onRemove }
        >
            <i className="icon-cancel"/>
        </button>
    }
    { canPlay &&
        <button
            className="timer__control-button"
            title={ active ? 'Pause' : 'Play' }
            onClick={ active ? onPause : onPlay }
        >
            <i className={ active ? 'icon-pause' : 'icon-play' }/>
        </button>
    }
    </div>
)

function getExportData( { tasks, timeFormat, exportFormat } ) {
    switch ( exportFormat ) {
        case EXPORT_FORMAT.CSV: {
            return tasks.map( ( { title, seconds } ) =>
                `${title.replace( /\|/g, '' )}|${seconds}|${formatNumberTime( seconds, timeFormat )}`
            ).join( '\n' )
        }

        case EXPORT_FORMAT.JSON:
        default: {
            const totalSeconds = tasks.reduce( ( prev, task ) => prev + task.seconds, 0 )
            const formattedTasks = tasks.map( ( { title, seconds } ) => ( {
                title,
                seconds,
                secondsFormatted: formatNumberTime( seconds, timeFormat )
            } ) )
            return JSON.stringify( {
                tasks: formattedTasks,
                overall: {
                    seconds: totalSeconds,
                    totalSeconds: formatNumberTime( totalSeconds, timeFormat )
                }
            }, null, 2 )
        }
    }
}

function usePersistentObjectState( localStorageKeyName, initialState ) {
    const preservedState = useRef( null )
    const preservedStateWasInvalid = useRef( false )
    const preservedStateWasInitialized = useRef( false )

    if ( !preservedStateWasInitialized.current ) {
        try {
            preservedState.current = localStorage.getItem( localStorageKeyName )
            if ( preservedState.current ) {
                preservedState.current = JSON.parse( preservedState.current )
            }
        } catch ( err ) {
            console.error( err )
            preservedStateWasInvalid.current = true
        }

        preservedStateWasInitialized.current = true
    }

    const [state, setState] = useState( preservedStateWasInvalid.current || !preservedState.current ? initialState : preservedState.current )

    const setPersistedState = useCallback( newState => {
        const updatedState = {
            ...state,
            ...newState
        }
        setState( updatedState )
        localStorage.setItem( localStorageKeyName, JSON.stringify( updatedState ) )
    }, [state] )

    const clearState = useCallback( () => {
        localStorage.removeItem( localStorageKeyName )
    }, [] )

    return [state, setPersistedState, preservedStateWasInvalid.current, clearState]
}

function useDarkMode( darkMode ) {
    useEffect( () => {
        if ( darkMode ) {
            document.body.classList.add( 'dark' )
        } else {
            document.body.classList.remove( 'dark' )
        }
    }, [darkMode] )
}

function ChirpinatorApp() {
    const [{ maxAppWidth, exportFormat, timeFormat, darkMode }, setSettings] = usePersistentObjectState( 'chirpinator_settings', {
        maxAppWidth: PAGE_WIDTH.SHORT,
        exportFormat: EXPORT_FORMAT.JSON,
        timeFormat: TIME_FORMAT.HH_MM_SS,

        darkMode: false
    } )
    useDarkMode( darkMode )

    const [chirpinatorTasks, setState, tasksGotCorrupted, clearTasksInLocalStorage] = usePersistentObjectState( 'chirpinator_tasks', {
        activeTaskId: null,
        lastActiveTaskId: null,

        tasks: []
    } )
    const { activeTaskId, lastActiveTaskId, tasks } = chirpinatorTasks
    const [idCounter, setIdCounter] = useState( tasks.reduce( ( prev, task ) => task.id > prev ? task.id : prev, 0 ) + 1 )
    const [taskIdToFocusOn, setTaskIdToFocusOn] = useState( null )

    const taskListRef = useRef( null )
    const focusedTaskRef = useRef( null )
    const exportContentRef = useRef( null )

    useEffect( function nextFrame() {
        if ( activeTaskId === null ) {
            return
        }

        const timeout = setTimeout( () => setState( {
            tasks: tasks.map( ( task ) => task.id !== activeTaskId ? task : { ...task, seconds: task.seconds + 1 } )
        } ), 1000 )

        return () => {
            clearTimeout( timeout )
        }
    }, [chirpinatorTasks] )

    useEffect( function focusOnTaskIfRequired() {
        if ( !focusedTaskRef.current ) {
            return
        }

        const { scrollHeight, clientHeight } = taskListRef.current
        taskListRef.current.scrollTop = scrollHeight - clientHeight
        focusedTaskRef.current.focus()

        setTaskIdToFocusOn( null )
    }, [tasks] )

    useEffect( function handlePauseHotkey() {
        window.onkeydown = e => {
            if ( e.target.tagName !== 'BODY' ) {
                return
            }

            if ( e.keyCode !== 32 ) {
                return
            }

            setState( { activeTaskId: activeTaskId ? null : lastActiveTaskId } )

            e.preventDefault()
        }
    }, [chirpinatorTasks] )

    const totalSeconds = tasks.reduce( ( prev, task ) => prev + task.seconds, 0 )
    const lastActiveTask = tasks.find( task => task.id === lastActiveTaskId )

    const [activePage, setActivePage] = useState( tasksGotCorrupted ? PAGE.CRITICAL_FAILURE : PAGE.CHIRPINATOR )

    return (
        <div id="chirpinator" style={ { maxWidth: maxAppWidth === PAGE_WIDTH.FULL ? '100%' : `${maxAppWidth}px` } }>
        { activePage !== PAGE.CRITICAL_FAILURE &&
            <div className="nav">
                <div
                    className={ `nav__link${activePage === PAGE.EXPORT ? ' nav__link_active' : ''}` }
                    onClick={ () => { setActivePage( PAGE.EXPORT ) } }
                >
                    EXPORT
                </div>
                <div
                    className={ `nav__link${activePage === PAGE.CHIRPINATOR ? ' nav__link_active' : ''}` }
                    onClick={ () => { setActivePage( PAGE.CHIRPINATOR ) } }
                >
                    CHIRPINATOR
                </div>
                <div
                    className={ `nav__link${activePage === PAGE.SETTINGS ? ' nav__link_active' : ''}` }
                    onClick={ () => { setActivePage( PAGE.SETTINGS ) } }
                >
                    SETTINGS
                </div>
            </div>
        }
        { activePage === PAGE.CHIRPINATOR &&
            <div className="tasks page">
                <div className="tasks__tasks-header tasks-header">
                    <div className="tasks-header__overall">Overall time</div>
                    <Timer
                        big
                        timeString={ formatNumberTime( totalSeconds, timeFormat ) }
                        active={ activeTaskId === lastActiveTaskId }
                        canPlay={ lastActiveTask }
                        onPlay={ () => setState( { activeTaskId: lastActiveTaskId } ) }
                        onPause={ () => setState( { activeTaskId: null } ) }
                    />
                    <div className="tasks-header__active-task">
                        { !lastActiveTask ? 'No task selected' :
                        !lastActiveTask.title ? 'Untitled task' :
                        lastActiveTask.title }
                    </div>
                </div>
                <div className="tasks__list" ref={ taskListRef }>
                { tasks.map( ( { id, title, seconds }, index ) => (
                    <div key={ id } className={ `task${id === activeTaskId ? ' task_active' : ''}` }>
                        <input
                            className="task__input"
                            placeholder="Enter the name of task..."
                            value={ title }
                            ref={ id === taskIdToFocusOn ? focusedTaskRef : null }
                            onChange={ e => {
                                const title = e.target.value
                                setState( {
                                    tasks: tasks.map( ( task, taskIndex ) => index !== taskIndex ? task : { ...task, title } )
                                } )
                            } }
                            onKeyDown={ e => {
                                if ( e.keyCode === 13 ) {
                                    setState( { activeTaskId: id, lastActiveTaskId: id } )
                                    e.target.blur()
                                }
                            } }
                        />
                        <Timer
                            className="task__timer"
                            timeString={ formatNumberTime( seconds, timeFormat ) }
                            active={ activeTaskId === id }
                            canPlay
                            canRemove
                            onPlay={ () => {
                                setState( { activeTaskId: id, lastActiveTaskId: id } )
                            } }
                            onPause={ () => {
                                setState( { activeTaskId: null } )
                            } }
                            onRemove={ () => {
                                setState( {
                                    activeTaskId: activeTaskId === id ? null : activeTaskId,
                                    tasks: tasks.filter( ( _, taskIndex ) => index !== taskIndex )
                                } )
                            } }
                        />
                    </div>
                ) ) }
                </div>
                <button
                    className="tasks__add-new-task-button"
                    onClick={ () => {
                        setState( {
                            tasks: tasks.concat( {
                                id: idCounter,
                                title: '',
                                seconds: 0
                            } )
                        } )
                        setIdCounter( idCounter + 1 )
                        setTaskIdToFocusOn( idCounter )
                    } }
                >
                    Add new
                </button>
            </div>
        }
        { activePage === PAGE.EXPORT &&
            <div className="export page">
                <div className="export__content">
                    <div className="export-dialog">
                        <div className="export-dialog__options">
                            <div
                                className={ `export-dialog__option-button${exportFormat === EXPORT_FORMAT.JSON ? ' export-dialog__option-button_active' : ''}` }
                                onClick={ () => setSettings( { exportFormat: EXPORT_FORMAT.JSON } ) }
                            >
                                JSON
                            </div>
                            <div
                                className={ `export-dialog__option-button${exportFormat === EXPORT_FORMAT.CSV ? ' export-dialog__option-button_active' : ''}` }
                                onClick={ () => setSettings( { exportFormat: EXPORT_FORMAT.CSV } ) }
                            >
                                CSV
                            </div>
                        </div>
                        <pre
                            key={ exportFormat }
                            className="export-dialog__content"
                            ref={ exportContentRef }
                            onClick={ () => {
                                const selection = window.getSelection()
                                const range = document.createRange()
                                range.selectNodeContents( exportContentRef.current )
                                selection.removeAllRanges()
                                selection.addRange( range )
                            } }
                        >
                            { getExportData( { tasks, timeFormat, exportFormat } ) }
                        </pre>
                    </div>
                </div>
            </div>
        }
        { activePage === PAGE.SETTINGS &&
            <div className="settings page">
                <div className="settings__content">
                    <div className="setting-row">
                        <label htmlFor="timeFormat">Time format</label>
                        <select
                            name="timeFormat"
                            value={ timeFormat }
                            onChange={ e => setSettings( { timeFormat: e.target.value } ) }
                        >
                            <option value={ TIME_FORMAT.HH_MM_SS }>Hours:Minutes:Seconds</option>
                            <option value={ TIME_FORMAT.MM_SS }>Minutes:Seconds</option>
                            <option value={ TIME_FORMAT.H_MM }>Hours.HourFraction</option>
                            <option value={ TIME_FORMAT.SS }>Seconds</option>
                        </select>
                    </div>
                    <div className="setting-row">
                        <label htmlFor="pageWidth">Max page width</label>
                        <select
                            name="pageWidth"
                            value={ maxAppWidth }
                            onChange={ e => setSettings( { maxAppWidth: e.target.value } ) }
                        >
                            <option value={ PAGE_WIDTH.FULL }>Full width</option>
                            <option value={ PAGE_WIDTH.WIDE }>Wide (1000px)</option>
                            <option value={ PAGE_WIDTH.MEDIUM }>Medium (700px)</option>
                            <option value={ PAGE_WIDTH.SHORT }>Short (400px)</option>
                        </select>
                    </div>
                    <div className="setting-row">
                        <label htmlFor="darkMode">Dark mode</label>
                        <button onClick={ () => setSettings( { darkMode: !darkMode } ) }>
                            { darkMode ? 'ON' : 'OFF' }
                        </button>
                    </div>
                </div>

                <h4 className="settings__about">
                    <a href="https://suxin.space">suxin.space</a> | <a href="https://github.com/suXinjke/chirpinator">GitHub</a>
                </h4>
            </div>
        }
        { activePage === PAGE.CRITICAL_FAILURE &&
            <div className="criticalFailure page">
                <strong>CHIRPINATOR</strong> failed to load your preserved tasks and data from <strong>localStorage</strong>.
                It was probably corrupted.

                <br/>
                <br/>
                <button onClick={ () => {
                    clearTasksInLocalStorage()
                    setActivePage( PAGE.CHIRPINATOR )
                } }>
                    Start fresh
                </button>
            </div>
        }
        </div>
    )
}

export default ChirpinatorApp