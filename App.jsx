import React from 'react'
import { hot } from 'react-hot-loader'

import './fonts/fonts.css'
import './icons/css/fontello.css'
import './App.scss'

const TIME_FORMAT = {
    HH_MM_SS: 'HH_MM_SS',
    MM_SS: 'MM_SS',
    H_MM: 'H_MM',
    SS: 'SS'
}

function formatNumberTime( timeInSeconds = 0, timeFormat = TIME_FORMAT.HH_MM_SS ) {
    if ( timeFormat === TIME_FORMAT.SS ) {
        return `${timeInSeconds} sec.`
    }

    const hours   = Math.floor( timeInSeconds / 3600 )
    const minutes = Math.floor( ( timeInSeconds / 60 ) % 60 )
    const seconds = Math.floor( timeInSeconds % 60 )

    switch ( timeFormat ) {
        case TIME_FORMAT.H_MM:
            const hourFraction = ( minutes + ( seconds / 60 ) ) / 60
            return `${(hours+hourFraction).toFixed( 2 )} hrs.`
        case TIME_FORMAT.MM_SS: {
            const paddedSeconds = seconds.toString().padStart( 2, "0" )
            return `${hours * 60 + minutes}:${paddedSeconds}`
        }
        case TIME_FORMAT.HH_MM_SS:
        default: {
            const paddedHours   = hours.toString().padStart( 2, "0" )
            const paddedMinutes = minutes.toString().padStart( 2, "0" )
            const paddedSeconds = seconds.toString().padStart( 2, "0" )
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
    <div className={`timer ${className} ${active ? 'timer_active' : ''} ${big ? 'timer_big' : ''}`.trim()}>
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

const PAGE = {
    CHIRPINATOR: 'CHIRPINATOR',
    EXPORT: 'EXPORT',
    SETTINGS: 'SETTINGS'
}

const defaultState = {
    idCounter: 1,
    activeTaskId: null,
    lastActiveTaskId: null,
    tasks: [],

    activePage: PAGE.CHIRPINATOR,
    timeFormat: TIME_FORMAT.HH_MM_SS
}

class App extends React.Component {

    constructor( props ) {
        super( props )

        this.lastTaskRef = React.createRef()
        this.taskListRef = React.createRef()

        const preservedState = localStorage.getItem( 'chirpinatorState' )
        this.state = {
            ...defaultState,
            ...(preservedState ? JSON.parse( preservedState ) : {})
        }
    }

    componentDidMount() {
        setInterval( () => {
            this.setState( ( { activeTaskId, tasks } ) => {
                if ( activeTaskId === null ) {
                    return
                }

                return {
                    tasks: tasks.map( ( task ) => task.id !== activeTaskId ? task : { ...task, seconds: task.seconds + 1 } )
                }
            }, () => {
                localStorage.setItem( 'chirpinatorState', JSON.stringify( this.state ) )
            } )
        }, 1000 )
    }

    addNewTask = () => {
        const { idCounter, tasks } = this.state
        this.setState( {
            tasks: tasks.concat( {
                id: idCounter,
                title: '',
                seconds: 0
            } ),
            idCounter: idCounter + 1
        }, () => {
            const { scrollHeight, clientHeight } = this.taskListRef.current;
            this.taskListRef.current.scrollTop = scrollHeight - clientHeight;
            this.lastTaskRef.current.focus()
        }  )
    }

    render() {
        const { tasks, activeTaskId, lastActiveTaskId, timeFormat, activePage } = this.state

        const totalSeconds = tasks.reduce( ( prev, task ) => prev + task.seconds, 0 )
        const lastActiveTask = tasks.find( task => task.id === lastActiveTaskId )

        return (<React.Fragment>
            <div className="nav">
                {/* <div
                    className={`nav__link${activePage === PAGE.EXPORT ? ' nav__link_active' : ''}`}
                    onClick={ () => { this.setState( { activePage: PAGE.EXPORT } ) } }
                >
                    EXPORT
                </div> */}
                <div
                    className={`nav__link${activePage === PAGE.CHIRPINATOR ? ' nav__link_active' : ''}`}
                    onClick={ () => { this.setState( { activePage: PAGE.CHIRPINATOR } ) } }
                >
                    CHIRPINATOR
                </div>
                <div
                    className={`nav__link${activePage === PAGE.SETTINGS ? ' nav__link_active' : ''}`}
                    onClick={ () => { this.setState( { activePage: PAGE.SETTINGS } ) } }
                >
                    SETTINGS
                </div>
            </div>
        { activePage === PAGE.CHIRPINATOR &&
            <div className="tasks page">
                <div className="tasks__tasks-header tasks-header">
                    <div className="tasks-header__overall">Overall time</div>
                    <Timer
                        big
                        timeString={ formatNumberTime( totalSeconds, timeFormat ) }
                        active={activeTaskId === lastActiveTaskId}
                        canPlay={lastActiveTask}
                        onPlay={ () => {
                            this.setState( { activeTaskId: lastActiveTaskId } )
                        } }
                        onPause={ () => {
                            this.setState( { activeTaskId: null } )
                        } }
                    />
                    <div className="tasks-header__active-task">
                        { !lastActiveTask ? 'No task selected' :
                        !lastActiveTask.title ? 'Untitled task' :
                        lastActiveTask.title }
                    </div>
                </div>
                <div className="tasks__list" ref={this.taskListRef}>
                { tasks.map( ( { id, title, seconds }, index ) => (
                    <div key={id} className={`task${id === activeTaskId ? ' task_active' : ''}`}>
                        <input
                            className="task__input"
                            placeholder="Enter the name of task..."
                            value={title}
                            ref={index === tasks.length - 1 ? this.lastTaskRef : null}
                            onChange={ e => {
                                const title = e.target.value
                                this.setState( {
                                    tasks: tasks.map( ( task, taskIndex ) => index !== taskIndex ? task : { ...task, title } )
                                } )
                            } }
                        />
                        <Timer
                            className='task__timer'
                            timeString={formatNumberTime( seconds, timeFormat )}
                            active={activeTaskId === id}
                            canPlay
                            canRemove
                            active={activeTaskId === id}
                            onPlay={ () => {
                                this.setState( { activeTaskId: id, lastActiveTaskId: id } )
                            } }
                            onPause={ () => {
                                this.setState( { activeTaskId: null } )
                            } }
                            onRemove={ () => {
                                this.setState( {
                                    activeTaskId: activeTaskId === id ? null : activeTaskId,
                                    tasks: tasks.filter( ( _, taskIndex ) => index !== taskIndex )
                                } )
                            } }
                        />
                    </div>
                ) ) }
                </div>
                <button className="tasks__add-new-task-button" onClick={ this.addNewTask }>Add new</button>
            </div>
        }
        { activePage === PAGE.EXPORT &&
            <div className="export page">
                <div className="export__content">
                    <h2>Coming soon</h2>
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
                            onChange={ e => this.setState( { timeFormat: e.target.value } ) }
                        >
                            <option value={TIME_FORMAT.HH_MM_SS}>Hours:Minutes:Seconds</option>
                            <option value={TIME_FORMAT.MM_SS}>Minutes:Seconds</option>
                            <option value={TIME_FORMAT.H_MM}>Hours.HourFraction</option>
                            <option value={TIME_FORMAT.SS}>Seconds</option>
                        </select>
                    </div>
                </div>

                <h4 className="settings__about">
                    <a href="https://suxin.space">suxin.space</a> | <a href="https://github.com/suXinjke/chirpinator">GitHub</a>
                </h4>
            </div>
        }
        </React.Fragment>)
    }
}

export default hot( module )( App )