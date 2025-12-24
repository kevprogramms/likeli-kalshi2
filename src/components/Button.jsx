import './Button.css'

function Button({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    fullWidth = false,
    onClick,
    className = '',
    ...props
}) {
    return (
        <button
            className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
            disabled={disabled}
            onClick={onClick}
            {...props}
        >
            {children}
        </button>
    )
}

export default Button
