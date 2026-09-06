// Campo-armadilha anti-spam: bots costumam preencher qualquer campo de
// formulário, humanos nunca veem este (fora da tela, ignorado por leitores
// de tela). Se vier preenchido no submit, tratamos como bot.
function HoneypotField({ value, onChange }) {
    return (
        <input
            type="text"
            name="website"
            value={value}
            onChange={onChange}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
        />
    );
}

export default HoneypotField;
